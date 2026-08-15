import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../../../services/apiClient";

export type ResourceState<T> = {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  retry: () => void;
};

export function useResource<T>(path: string | undefined): ResourceState<T> {
  const [state, setState] = useState<Omit<ResourceState<T>, "retry">>({
    data: undefined,
    loading: false,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setState({ data: undefined, loading: true, error: null });
    apiGet<T>(path)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: undefined,
            loading: false,
            error: error instanceof Error ? error.message : "Unexpected error",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  return { ...state, retry };
}