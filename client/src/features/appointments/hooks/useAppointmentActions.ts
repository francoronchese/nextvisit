import { useCallback, useState } from "react";
import { apiPost, isConflictError } from "../../../services/apiClient";
import type { Appointment, ReschedulePayload } from "../appointments.types";

export type AppointmentActionResult =
  | { kind: "cancelled"; appointment: Appointment }
  | { kind: "rescheduled"; appointment: Appointment };

export type AppointmentActionState = {
  acting: boolean;
  error: string | null;
  slotUnavailable: boolean;
  result: AppointmentActionResult | null;
};

export function useAppointmentActions(token: string | undefined) {
  const [state, setState] = useState<AppointmentActionState>({
    acting: false,
    error: null,
    slotUnavailable: false,
    result: null,
  });

  const run = useCallback(
    async (action: AppointmentActionResult["kind"], path: string, body?: unknown) => {
      if (!token) return;
      setState({ acting: true, error: null, slotUnavailable: false, result: null });
      try {
        const appointment = await apiPost<Appointment>(path, body);
        setState({ acting: false, error: null, slotUnavailable: false, result: { kind: action, appointment } });
      } catch (error) {
        // A 409 on reschedule means someone else took the target slot since the
        // grid loaded; the grid must refresh. The other errors (including the
        // 409 when the cancellation window is closed) only need the message.
        const slotUnavailable = action === "rescheduled" && isConflictError(error);
        setState({
          acting: false,
          error: error instanceof Error ? error.message : "Unexpected error",
          slotUnavailable,
          result: null,
        });
      }
    },
    [token]
  );

  const cancel = useCallback(() => run("cancelled", `/api/appointments/${token}/cancel`), [token, run]);

  const reschedule = useCallback(
    (payload: ReschedulePayload) => run("rescheduled", `/api/appointments/${token}/reschedule`, payload),
    [token, run]
  );

  return { ...state, cancel, reschedule };
}