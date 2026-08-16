import { useCallback, useState } from "react";
import { apiPost, clearStaffSessionToken, setStaffSessionToken } from "../../../services/apiClient";
import type { LoginCredentials, LoginResponse } from "../admin.types";

export type LoginState = {
  user: LoginResponse["user"] | null;
  loading: boolean;
  error: string | null;
};

export function useAdminLogin() {
  const [state, setState] = useState<LoginState>({ user: null, loading: false, error: null });

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState({ user: null, loading: true, error: null });
    try {
      const result = await apiPost<LoginResponse>("/api/admin/login", credentials);
      setStaffSessionToken(result.token);
      setState({ user: result.user, loading: false, error: null });
    } catch (error: unknown) {
      setState({
        user: null,
        loading: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      });
    }
  }, []);

  const logout = useCallback(() => {
    clearStaffSessionToken();
    setState({ user: null, loading: false, error: null });
  }, []);

  return { ...state, login, logout };
}