import type { Doctor } from "../admin.types";
import { useResource } from "../../../hooks/useResource";

export function useAdminDoctors() {
  return useResource<Doctor[]>("/api/admin/doctors");
}