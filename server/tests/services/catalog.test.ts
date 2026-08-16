import { describe, expect, it } from "vitest";
import type { AppointmentType, Doctor, HealthInsurance, Specialty } from "@nextvisit/shared";
import { createCatalogService, type CatalogQueries } from "../../src/services/catalog";

const cardio: Specialty = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Cardiology" };
const derma: Specialty = { id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12", name: "Dermatology" };

const consultaCardio: AppointmentType = {
  id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
  specialtyId: cardio.id,
  name: "Cardiology consultation",
  durationMinutes: 30,
};
const ecocardiograma: AppointmentType = {
  id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14",
  specialtyId: cardio.id,
  name: "Echocardiogram",
  durationMinutes: 45,
};
const consultaDerma: AppointmentType = {
  id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15",
  specialtyId: derma.id,
  name: "Dermatology consultation",
  durationMinutes: 30,
};

const maria: Doctor = {
  id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16",
  specialtyId: cardio.id,
  firstName: "María",
  lastName: "González",
};
const jorge: Doctor = {
  id: "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a17",
  specialtyId: cardio.id,
  firstName: "Jorge",
  lastName: "Fernández",
};
const lucia: Doctor = {
  id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18",
  specialtyId: derma.id,
  firstName: "Lucía",
  lastName: "Rodríguez",
};

const insuranceIoma: HealthInsurance = {
  id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a1a",
  name: "IOMA",
  copayAmount: 5000,
};

function buildFakeQueries(): CatalogQueries {
  const specialties: Specialty[] = [cardio, derma];
  const types: AppointmentType[] = [consultaCardio, ecocardiograma, consultaDerma];
  const doctors: Doctor[] = [maria, jorge, lucia];
  const doctorsByType: Record<string, Doctor[]> = {
    [consultaCardio.id]: [maria, jorge],
    [ecocardiograma.id]: [maria],
    [consultaDerma.id]: [lucia],
  };
  return {
    listSpecialties: () => Promise.resolve(specialties),
    getSpecialtyById: (id) => Promise.resolve(specialties.find((s) => s.id === id)),
    listAppointmentTypesForSpecialty: (id) =>
      Promise.resolve(types.filter((t) => t.specialtyId === id)),
    getAppointmentTypeById: (id) => Promise.resolve(types.find((t) => t.id === id)),
    listDoctorsForType: (id) => Promise.resolve(doctorsByType[id] ?? []),
    listHealthInsurances: () => Promise.resolve([insuranceIoma]),
  };
}

const UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

describe("catalog service", () => {
  it("lists all specialties", async () => {
    const service = createCatalogService(buildFakeQueries());
    await expect(service.getSpecialties()).resolves.toEqual([cardio, derma]);
  });

  it("lists the appointment types of a specialty", async () => {
    const service = createCatalogService(buildFakeQueries());
    await expect(service.getAppointmentTypesForSpecialty(cardio.id)).resolves.toEqual([
      consultaCardio,
      ecocardiograma,
    ]);
  });

  it("rejects an unknown specialty", async () => {
    const service = createCatalogService(buildFakeQueries());
    await expect(
      service.getAppointmentTypesForSpecialty(UNKNOWN_ID)
    ).rejects.toMatchObject({ status: 404 });
  });

  it("lists the doctors offering an appointment type", async () => {
    const service = createCatalogService(buildFakeQueries());
    await expect(service.getDoctorsForType(ecocardiograma.id)).resolves.toEqual([maria]);
  });

  it("rejects an unknown appointment type", async () => {
    const service = createCatalogService(buildFakeQueries());
    await expect(service.getDoctorsForType(UNKNOWN_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("lists health insurances", async () => {
    const service = createCatalogService(buildFakeQueries());
    await expect(service.getHealthInsurances()).resolves.toEqual([insuranceIoma]);
  });
});