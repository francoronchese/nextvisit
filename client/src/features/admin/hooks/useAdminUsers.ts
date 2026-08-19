import { useCallback, useState } from "react";
import type { User } from "@nextvisit/shared";
import { useResource } from "../../../hooks/useResource";
import { apiPost } from "../../../services/apiClient";
import type { CreateUserPayload } from "../admin.types";

export type CreateUserState = {
  created: User | null;
  submitting: boolean;
  createError: string | null;
};

export function useAdminUsers() {
  const { data, loading, error, retry } = useResource<User[]>("/api/admin/users");
  const [state, setState] = useState<CreateUserState>({
    created: null,
    submitting: false,
    createError: null,
  });

  const create = useCallback(
    async (payload: CreateUserPayload): Promise<User | null> => {
      setState({ created: null, submitting: true, createError: null });
      try {
        const user = await apiPost<User>("/api/admin/users", payload);
        setState({ created: user, submitting: false, createError: null });
        retry();
        return user;
      } catch (error: unknown) {
        setState({
          created: null,
          submitting: false,
          createError: error instanceof Error ? error.message : "Unexpected error",
        });
        return null;
      }
    },
    [retry]
  );

  return { data, loading, error, retry, ...state, create };
}