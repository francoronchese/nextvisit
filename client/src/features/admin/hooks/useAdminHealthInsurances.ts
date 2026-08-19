import { useCallback } from "react";
import type { HealthInsurance } from "@nextvisit/shared";
import type { HealthInsuranceInput } from "../admin.types";
import { apiDelete, apiPost, apiPut } from "../../../services/apiClient";
import { useResource } from "../../../hooks/useResource";

export function useAdminHealthInsurances() {
  const { data, loading, error, retry } = useResource<HealthInsurance[]>(
    "/api/admin/health-insurances"
  );

  const create = useCallback(
    async (input: HealthInsuranceInput) => {
      await apiPost<HealthInsurance>("/api/admin/health-insurances", input);
      retry();
    },
    [retry]
  );

  const update = useCallback(
    async (id: string, input: HealthInsuranceInput) => {
      await apiPut<HealthInsurance>(`/api/admin/health-insurances/${id}`, input);
      retry();
    },
    [retry]
  );

  const remove = useCallback(
    async (id: string) => {
      await apiDelete(`/api/admin/health-insurances/${id}`);
      retry();
    },
    [retry]
  );

  return {
    insurances: data ?? [],
    loading,
    error,
    retry,
    create,
    update,
    remove,
  };
}
