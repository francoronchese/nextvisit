import { useCallback } from "react";
import type { Availability, AvailabilityInput } from "../admin.types";
import { apiDelete, apiPost, apiPut } from "../../../services/apiClient";
import { useResource } from "../../../hooks/useResource";

export function useAvailability(doctorId: string | undefined) {
  const path = doctorId ? `/api/admin/availability?doctorId=${doctorId}` : undefined;
  const { data, loading, error, retry } = useResource<Availability[]>(path);

  const addWindow = useCallback(
    async (input: AvailabilityInput) => {
      await apiPost<Availability>("/api/admin/availability", input);
      retry();
    },
    [retry]
  );

  const updateWindow = useCallback(
    async (id: string, input: AvailabilityInput) => {
      await apiPut<Availability>(`/api/admin/availability/${id}`, input);
      retry();
    },
    [retry]
  );

  const removeWindow = useCallback(
    async (id: string) => {
      await apiDelete(`/api/admin/availability/${id}`);
      retry();
    },
    [retry]
  );

  return {
    weeklyHours: data ?? [],
    loading,
    error,
    retry,
    addWindow,
    updateWindow,
    removeWindow,
  };
}