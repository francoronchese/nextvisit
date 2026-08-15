import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { getTestDatabaseUrl } from "../../config/env";
import { runMigrations } from "../../src/db/migrate";
import app from "../../src/index";
import { truncateAll } from "../fixtures";

const pool = new Pool({ connectionString: getTestDatabaseUrl() });

type CatalogFixture = {
  cardioId: string;
  dermaId: string;
  consultaCardioId: string;
  ecocardiogramaId: string;
  consultaDermaId: string;
  mariaId: string;
  jorgeId: string;
  luciaId: string;
  anaId: string;
};

async function seedCatalog(): Promise<CatalogFixture> {
  const client = await pool.connect();
  try {
    const cardio = await client.query(
      "INSERT INTO specialties (name) VALUES ('Cardiology') RETURNING id"
    );
    const derma = await client.query(
      "INSERT INTO specialties (name) VALUES ('Dermatology') RETURNING id"
    );
    const cardioId = cardio.rows[0].id as string;
    const dermaId = derma.rows[0].id as string;

    const consultaCardio = await client.query(
      "INSERT INTO appointment_types (specialty_id, name, duration_minutes) VALUES ($1, $2, $3) RETURNING id",
      [cardioId, "Cardiology consultation", 30]
    );
    const ecocardiograma = await client.query(
      "INSERT INTO appointment_types (specialty_id, name, duration_minutes) VALUES ($1, $2, $3) RETURNING id",
      [cardioId, "Ecocardiograma", 45]
    );
    const consultaDerma = await client.query(
      "INSERT INTO appointment_types (specialty_id, name, duration_minutes) VALUES ($1, $2, $3) RETURNING id",
      [dermaId, "Dermatology consultation", 30]
    );
    const consultaCardioId = consultaCardio.rows[0].id as string;
    const ecocardiogramaId = ecocardiograma.rows[0].id as string;
    const consultaDermaId = consultaDerma.rows[0].id as string;

    const maria = await client.query(
      "INSERT INTO doctors (specialty_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id",
      [cardioId, "María", "González"]
    );
    const jorge = await client.query(
      "INSERT INTO doctors (specialty_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id",
      [cardioId, "Jorge", "Fernández"]
    );
    const lucia = await client.query(
      "INSERT INTO doctors (specialty_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id",
      [dermaId, "Lucía", "Rodríguez"]
    );
    const mariaId = maria.rows[0].id as string;
    const jorgeId = jorge.rows[0].id as string;
    const luciaId = lucia.rows[0].id as string;

    const ana = await client.query(
      "INSERT INTO doctors (specialty_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id",
      [dermaId, "Ana", "Pérez"]
    );
    const anaId = ana.rows[0].id as string;

    const offer = async (doctorId: string, typeId: string) => {
      await client.query(
        "INSERT INTO doctor_appointment_types (doctor_id, appointment_type_id) VALUES ($1, $2)",
        [doctorId, typeId]
      );
    };
    await offer(mariaId, consultaCardioId);
    await offer(mariaId, ecocardiogramaId);
    await offer(jorgeId, consultaCardioId);
    await offer(luciaId, consultaDermaId);
    await offer(anaId, consultaCardioId);

    return {
      cardioId,
      dermaId,
      consultaCardioId,
      ecocardiogramaId,
      consultaDermaId,
      mariaId,
      jorgeId,
      luciaId,
      anaId,
    };
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  await runMigrations(pool);
  await truncateAll(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("catalog API", () => {
  let fixture: CatalogFixture;

  beforeAll(async () => {
    fixture = await seedCatalog();
  });

  it("GET /api/specialties returns all specialties in name order", async () => {
    const res = await request(app).get("/api/specialties").expect(200);
    expect(res.body).toEqual([
      { id: fixture.cardioId, name: "Cardiology" },
      { id: fixture.dermaId, name: "Dermatology" },
    ]);
  });

  it("GET /api/specialties/:id/types returns the specialty's appointment types", async () => {
    const res = await request(app).get(`/api/specialties/${fixture.cardioId}/types`).expect(200);
    expect(res.body).toEqual([
      {
        id: fixture.consultaCardioId,
        specialtyId: fixture.cardioId,
        name: "Cardiology consultation",
        durationMinutes: 30,
      },
      {
        id: fixture.ecocardiogramaId,
        specialtyId: fixture.cardioId,
        name: "Ecocardiograma",
        durationMinutes: 45,
      },
    ]);
  });

  it("GET /api/types/:id/doctors returns only the doctors offering that type", async () => {
    const res = await request(app).get(`/api/types/${fixture.ecocardiogramaId}/doctors`).expect(200);
    expect(res.body).toEqual([
      { id: fixture.mariaId, specialtyId: fixture.cardioId, firstName: "María", lastName: "González" },
    ]);
  });

  it("GET /api/types/:id/doctors orders doctors by last name", async () => {
    const res = await request(app).get(`/api/types/${fixture.consultaCardioId}/doctors`).expect(200);
    expect(res.body).toEqual([
      { id: fixture.jorgeId, specialtyId: fixture.cardioId, firstName: "Jorge", lastName: "Fernández" },
      { id: fixture.mariaId, specialtyId: fixture.cardioId, firstName: "María", lastName: "González" },
    ]);
  });

  it("GET /api/types/:id/doctors excludes doctors from a different specialty", async () => {
    const res = await request(app).get(`/api/types/${fixture.consultaCardioId}/doctors`).expect(200);
    expect(res.body.map((doctor: { id: string }) => doctor.id)).not.toContain(fixture.anaId);
  });

  it("returns 404 for an unknown specialty", async () => {
    const res = await request(app)
      .get("/api/specialties/00000000-0000-0000-0000-000000000000/types")
      .expect(404);
    expect(res.body).toEqual({ error: "specialty not found" });
  });

  it("returns 404 for an unknown appointment type", async () => {
    const res = await request(app)
      .get("/api/types/00000000-0000-0000-0000-000000000000/doctors")
      .expect(404);
    expect(res.body).toEqual({ error: "type not found" });
  });

  it("returns 400 for a malformed specialty id", async () => {
    const res = await request(app).get("/api/specialties/not-a-uuid/types").expect(400);
    expect(res.body).toEqual({ error: "invalid id" });
  });
});