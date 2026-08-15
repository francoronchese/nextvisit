import type { AppointmentType, Doctor, Specialty } from "@nextvisit/shared";
import {
  getAppointmentTypeById,
  getSpecialtyById,
  listAppointmentTypesForSpecialty,
  listDoctorsForType,
  listSpecialties,
} from "../db/queries/catalog";

export type CatalogQueries = {
  listSpecialties(): Promise<Specialty[]>;
  getSpecialtyById(id: string): Promise<Specialty | undefined>;
  listAppointmentTypesForSpecialty(specialtyId: string): Promise<AppointmentType[]>;
  getAppointmentTypeById(id: string): Promise<AppointmentType | undefined>;
  listDoctorsForType(typeId: string): Promise<Doctor[]>;
};

export class CatalogNotFoundError extends Error {
  constructor(resource: "specialty" | "type") {
    super(`${resource} not found`);
    this.name = "CatalogNotFoundError";
  }
}

export type CatalogService = {
  getSpecialties(): Promise<Specialty[]>;
  getAppointmentTypesForSpecialty(specialtyId: string): Promise<AppointmentType[]>;
  getDoctorsForType(typeId: string): Promise<Doctor[]>;
};

async function requireChildren<T>(
  parentId: string,
  getParent: (id: string) => Promise<{ id: string } | undefined>,
  listChildren: (parentId: string) => Promise<T[]>,
  resource: "specialty" | "type"
): Promise<T[]> {
  const parent = await getParent(parentId);
  if (!parent) {
    throw new CatalogNotFoundError(resource);
  }
  return listChildren(parentId);
}

export function createCatalogService(queries: CatalogQueries): CatalogService {
  return {
    async getSpecialties() {
      return queries.listSpecialties();
    },
    getAppointmentTypesForSpecialty(specialtyId: string) {
      return requireChildren(
        specialtyId,
        queries.getSpecialtyById,
        queries.listAppointmentTypesForSpecialty,
        "specialty"
      );
    },
    getDoctorsForType(typeId: string) {
      return requireChildren(
        typeId,
        queries.getAppointmentTypeById,
        queries.listDoctorsForType,
        "type"
      );
    },
  };
}

export const catalogService = createCatalogService({
  listSpecialties,
  getSpecialtyById,
  listAppointmentTypesForSpecialty,
  getAppointmentTypeById,
  listDoctorsForType,
});