import { useCallback, useState } from "react";
import { apiPost, isConflictError } from "../services/apiClient";

export type CreateBookingState<TResult> = {
  result: TResult | null;
  submitting: boolean;
  error: string | null;
  slotUnavailable: boolean;
};

// Shared submission logic for every booking endpoint: the public web booking
// and the secretary booking on behalf both submit a slot + patient payload and
// react the same way to a slot that was just taken (409 → refresh the grid).
export function useCreateBooking<TResult, TPayload>(path: string) {
  const [state, setState] = useState<CreateBookingState<TResult>>({
    result: null,
    submitting: false,
    error: null,
    slotUnavailable: false,
  });

  const submit = useCallback(
    async (payload: TPayload) => {
      setState({ result: null, submitting: true, error: null, slotUnavailable: false });
      try {
        const result = await apiPost<TResult>(path, payload);
        setState({ result, submitting: false, error: null, slotUnavailable: false });
      } catch (error: unknown) {
        // 409 means the slot was taken by someone else since the grid loaded;
        // the grid must refresh. The 3-per-DNI cap is 422 and only needs the
        // message.
        const slotUnavailable = isConflictError(error);
        setState({
          result: null,
          submitting: false,
          error: error instanceof Error ? error.message : "Unexpected error",
          slotUnavailable,
        });
      }
    },
    [path]
  );

  return { ...state, submit };
}