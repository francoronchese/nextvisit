import bcrypt from "bcryptjs";
import type { UserRole } from "@nextvisit/shared";
import { pool, query, queryOne } from "./client";

const DEV_PASSWORD = "nextvisit123";

type SpecialtySeed = {
  name: string;
  types: { name: string; durationMinutes: number }[];
  doctors: { firstName: string; lastName: string }[];
};

const SPECIALTIES: SpecialtySeed[] = [
  {
    name: "Cardiología",
    types: [
      { name: "Consulta cardiológica", durationMinutes: 30 },
      { name: "Electrocardiograma", durationMinutes: 20 },
      { name: "Ecocardiograma", durationMinutes: 45 },
    ],
    doctors: [
      { firstName: "María", lastName: "González" },
      { firstName: "Jorge", lastName: "Fernández" },
    ],
  },
  {
    name: "Dermatología",
    types: [
      { name: "Consulta dermatológica", durationMinutes: 30 },
      { name: "Control de lunares", durationMinutes: 20 },
    ],
    doctors: [{ firstName: "Lucía", lastName: "Rodríguez" }],
  },
  {
    name: "Traumatología",
    types: [
      { name: "Consulta traumatológica", durationMinutes: 30 },
      { name: "Kinesiología", durationMinutes: 40 },
    ],
    doctors: [
      { firstName: "Carlos", lastName: "Martínez" },
      { firstName: "Ana", lastName: "López" },
    ],
  },
  {
    name: "Pediatría",
    types: [
      { name: "Consulta pediátrica", durationMinutes: 30 },
      { name: "Control de niño sano", durationMinutes: 20 },
    ],
    doctors: [{ firstName: "Sofía", lastName: "Pérez" }],
  },
];

const HEALTH_INSURANCES = [
  { name: "IOMA", copayAmount: 5000 },
  { name: "PAMI", copayAmount: 3000 },
  { name: "OSDE", copayAmount: 12000 },
  { name: "Swiss Medical", copayAmount: 15000 },
];

function toEmailPart(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

type Sql = { sql: string; params: unknown[] };

async function getOrInsert(select: Sql, insert: Sql): Promise<string> {
  const existing = await queryOne<{ id: string }>(select.sql, select.params);
  if (existing) return existing.id;
  const created = await queryOne<{ id: string }>(insert.sql, insert.params);
  return created!.id;
}

async function upsert(insert: Sql, onConflict: string): Promise<string> {
  const created = await queryOne<{ id: string }>(
    `${insert.sql} ON CONFLICT ${onConflict} RETURNING id`,
    insert.params
  );
  return created!.id;
}

async function upsertSpecialty(name: string): Promise<string> {
  return upsert(
    { sql: "INSERT INTO specialties (name) VALUES ($1)", params: [name] },
    "(name) DO UPDATE SET name = EXCLUDED.name"
  );
}

async function upsertAppointmentType(specialtyId: string, name: string, durationMinutes: number): Promise<string> {
  return upsert(
    {
      sql: "INSERT INTO appointment_types (specialty_id, name, duration_minutes) VALUES ($1, $2, $3)",
      params: [specialtyId, name, durationMinutes],
    },
    "(specialty_id, name) DO UPDATE SET duration_minutes = EXCLUDED.duration_minutes"
  );
}

async function upsertDoctor(specialtyId: string, firstName: string, lastName: string): Promise<string> {
  return getOrInsert(
    { sql: "SELECT id FROM doctors WHERE specialty_id = $1 AND first_name = $2 AND last_name = $3", params: [specialtyId, firstName, lastName] },
    { sql: "INSERT INTO doctors (specialty_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id", params: [specialtyId, firstName, lastName] }
  );
}

async function upsertDoctorAppointmentType(doctorId: string, typeId: string): Promise<void> {
  await pool.query(
    "INSERT INTO doctor_appointment_types (doctor_id, appointment_type_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [doctorId, typeId]
  );
}

async function upsertHealthInsurance(name: string, copayAmount: number): Promise<string> {
  return upsert(
    { sql: "INSERT INTO health_insurances (name, copay_amount) VALUES ($1, $2)", params: [name, copayAmount] },
    "(name) DO UPDATE SET copay_amount = EXCLUDED.copay_amount"
  );
}

async function upsertUser(email: string, role: UserRole, doctorId?: string): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const existing = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if (existing) {
    await pool.query(
      "UPDATE users SET role = $1, doctor_id = $2, password_hash = $3 WHERE id = $4",
      [role, doctorId ?? null, passwordHash, existing.id]
    );
    return;
  }
  await pool.query(
    "INSERT INTO users (email, password_hash, role, doctor_id) VALUES ($1, $2, $3, $4)",
    [email, passwordHash, role, doctorId ?? null]
  );
}

async function seed(): Promise<void> {
  const specialtyIds: Record<string, string> = {};
  const doctorIdsBySpecialty: Record<string, string[]> = {};

  for (const specialty of SPECIALTIES) {
    const specialtyId = await upsertSpecialty(specialty.name);
    specialtyIds[specialty.name] = specialtyId;

    for (const type of specialty.types) {
      await upsertAppointmentType(specialtyId, type.name, type.durationMinutes);
    }

    const doctorIds: string[] = [];
    for (const doctor of specialty.doctors) {
      const doctorId = await upsertDoctor(specialtyId, doctor.firstName, doctor.lastName);
      doctorIds.push(doctorId);
    }
    doctorIdsBySpecialty[specialty.name] = doctorIds;
  }

  for (const specialty of SPECIALTIES) {
    const specialtyId = specialtyIds[specialty.name]!;
    const typeIds = (
      await query<{ id: string }>(
        "SELECT id FROM appointment_types WHERE specialty_id = $1",
        [specialtyId]
      )
    ).map((r) => r.id);
    for (const doctorId of doctorIdsBySpecialty[specialty.name]!) {
      for (const typeId of typeIds) {
        await upsertDoctorAppointmentType(doctorId, typeId);
      }
    }
  }

  for (const insurance of HEALTH_INSURANCES) {
    await upsertHealthInsurance(insurance.name, insurance.copayAmount);
  }

  await upsertUser("admin@nextvisit.ar", "admin");
  await upsertUser("secretary@nextvisit.ar", "secretary");

  for (const specialty of SPECIALTIES) {
    const doctor = specialty.doctors[0]!;
    const doctorEmail = `${toEmailPart(doctor.firstName)}.${toEmailPart(doctor.lastName)}@nextvisit.ar`;
    await upsertUser(doctorEmail, "doctor", doctorIdsBySpecialty[specialty.name]![0]);
  }

  console.log("Seed complete.");
  console.log(`  Specialties: ${SPECIALTIES.length}`);
  console.log(`  Doctors: ${Object.values(doctorIdsBySpecialty).flat().length}`);
  console.log(`  Health insurances: ${HEALTH_INSURANCES.length}`);
  console.log("  Users: admin@nextvisit.ar, secretary@nextvisit.ar + one doctor user per specialty");
  console.log(`  Dev password for all seeded users: ${DEV_PASSWORD}`);
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());