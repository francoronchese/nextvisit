import { useCallback } from "react";
import type { AvailabilityBlock, AvailabilityBlockInput } from "../admin.types";
import { apiDelete, apiPost } from "../../../services/apiClient";
import { useResource } from "../../../hooks/useResource";

export function useAvailabilityBlocks(doctorId: string | undefined) {
  const path = doctorId ? `/api/admin/availability-blocks?doctorId=${doctorId}` : undefined;
  const { data, loading, error, retry } = useResource<AvailabilityBlock[]>(path);

  const addBlock = useCallback(
    async (input: AvailabilityBlockInput) => {
      await apiPost<AvailabilityBlock>("/api/admin/availability-blocks", input);
      retry();
    },
    [retry]
  );

  const removeBlock = useCallback(
    async (id: string) => {
      await apiDelete(`/api/admin/availability-blocks/${id}`);
      retry();
    },
    [retry]
  );

  return {
    blocks: data ?? [],
    loading,
    error,
    retry,
    addBlock,
    removeBlock,
  };
}