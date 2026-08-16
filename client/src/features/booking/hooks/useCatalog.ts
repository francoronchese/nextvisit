import type { AppointmentType, Doctor, HealthInsurance, Specialty } from "../booking.types";
import { useResource, type ResourceState } from "./useResource";

export function useSpecialties(): ResourceState<Specialty[]> {
  return useResource<Specialty[]>("/api/specialties");
}

export function useHealthInsurances(): ResourceState<HealthInsurance[]> {
  return useResource<HealthInsurance[]>("/api/health-insurances");
}

export function useAppointmentTypes(
  specialtyId: string | undefined
): ResourceState<AppointmentType[]> {
  const path = specialtyId ? `/api/specialties/${specialtyId}/types` : undefined;
  return useResource<AppointmentType[]>(path);
}

export function useDoctorsForType(typeId: string | undefined): ResourceState<Doctor[]> {
  const path = typeId ? `/api/types/${typeId}/doctors` : undefined;
  return useResource<Doctor[]>(path);
}