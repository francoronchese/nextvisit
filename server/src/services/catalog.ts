import type { AppointmentType, Doctor, Specialty } from "@nextvisit/shared";
import {
  getAppointmentTypeById,
  getSpecialtyById,
  listAppointmentTypesForSpecialty,
  listDoctorsForType,
  listSpecialties,
} from "../db/queries/catalog";
import { NotFoundError } from "../utils/notFoundError";

export type CatalogQueries = {
  listSpecialties(): Promise<Specialty[]>;
  getSpecialtyById(id: string): Promise<Specialty | undefined>;
  listAppointmentTypesForSpecialty(specialtyId: string): Promise<AppointmentType[]>;
  getAppointmentTypeById(id: string): Promise<AppointmentType | undefined>;
  listDoctorsForType(typeId: string): Promise<Doctor[]>;
};

export type CatalogService = {
  getSpecialties(): Promise<Specialty[]>;
  getAppointmentTypesForSpecialty(specialtyId: string): Promise<AppointmentType[]>;
  getDoctorsForType(typeId: string): Promise<Doctor[]>;
};

async function listChildrenOfExistingParent<T>(
  parentId: string,
  getParent: (id: string) => Promise<{ id: string } | undefined>,
  listChildren: (parentId: string) => Promise<T[]>,
  resource: string
): Promise<T[]> {
  const parent = await getParent(parentId);
  if (!parent) {
    throw new NotFoundError(resource);
  }
  return listChildren(parentId);
}

export function createCatalogService(queries: CatalogQueries): CatalogService {
  return {
    async getSpecialties() {
      return queries.listSpecialties();
    },
    getAppointmentTypesForSpecialty(specialtyId: string) {
      return listChildrenOfExistingParent(
        specialtyId,
        queries.getSpecialtyById,
        queries.listAppointmentTypesForSpecialty,
        "specialty"
      );
    },
    getDoctorsForType(typeId: string) {
      return listChildrenOfExistingParent(
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