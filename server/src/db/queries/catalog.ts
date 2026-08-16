import type { AppointmentType, Doctor, HealthInsurance, Specialty } from "@nextvisit/shared";
import { query, queryOne } from "../client";

export async function listSpecialties(): Promise<Specialty[]> {
  return query<Specialty>("SELECT id, name FROM specialties ORDER BY name");
}

export const HEALTH_INSURANCE_COLUMNS = `id, name, copay_amount::float8 AS "copayAmount"`;

export async function listHealthInsurances(): Promise<HealthInsurance[]> {
  return query<HealthInsurance>(
    `SELECT ${HEALTH_INSURANCE_COLUMNS}
     FROM health_insurances
     ORDER BY name`
  );
}

export async function getSpecialtyById(id: string): Promise<Specialty | undefined> {
  return queryOne<Specialty>("SELECT id, name FROM specialties WHERE id = $1", [id]);
}

export async function listAppointmentTypesForSpecialty(
  specialtyId: string
): Promise<AppointmentType[]> {
  return query<AppointmentType>(
    `SELECT id, specialty_id AS "specialtyId", name, duration_minutes AS "durationMinutes"
     FROM appointment_types
     WHERE specialty_id = $1
     ORDER BY name`,
    [specialtyId]
  );
}

export async function getAppointmentTypeById(id: string): Promise<AppointmentType | undefined> {
  return queryOne<AppointmentType>(
    `SELECT id, specialty_id AS "specialtyId", name, duration_minutes AS "durationMinutes"
     FROM appointment_types
     WHERE id = $1`,
    [id]
  );
}

export async function listDoctorsForType(typeId: string): Promise<Doctor[]> {
  return query<Doctor>(
    `SELECT d.id, d.specialty_id AS "specialtyId", d.first_name AS "firstName", d.last_name AS "lastName"
     FROM doctors d
     JOIN doctor_appointment_types dat ON dat.doctor_id = d.id
     JOIN appointment_types t ON t.id = dat.appointment_type_id
     WHERE dat.appointment_type_id = $1 AND d.specialty_id = t.specialty_id
     ORDER BY d.last_name, d.first_name`,
    [typeId]
  );
}