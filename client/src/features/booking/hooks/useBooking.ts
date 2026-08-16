import { useCallback, useState } from "react";
import { ApiError, apiPost } from "../../../services/apiClient";
import type { BookingPayload, BookingResult } from "../booking.types";

export type BookingState = {
  result: BookingResult | null;
  submitting: boolean;
  error: string | null;
  slotUnavailable: boolean;
};

export function useBooking() {
  const [state, setState] = useState<BookingState>({
    result: null,
    submitting: false,
    error: null,
    slotUnavailable: false,
  });

  const submit = useCallback(async (payload: BookingPayload) => {
    setState({ result: null, submitting: true, error: null, slotUnavailable: false });
    try {
      const result = await apiPost<BookingResult>("/api/bookings", payload);
      setState({ result, submitting: false, error: null, slotUnavailable: false });
    } catch (error: unknown) {
      // 409 means the slot was taken by someone else since the grid loaded; the
      // grid must refresh. The 3-per-DNI cap is 422 and only needs the message.
      const slotUnavailable = error instanceof ApiError && error.status === 409;
      setState({
        result: null,
        submitting: false,
        error: error instanceof Error ? error.message : "Unexpected error",
        slotUnavailable,
      });
    }
  }, []);

  return { ...state, submit };
}