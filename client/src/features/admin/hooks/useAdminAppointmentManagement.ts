import { useCallback, useState } from "react";
import type { Slot } from "@nextvisit/shared";
import { apiPost, isConflictError } from "../../../services/apiClient";

export type AppointmentManagementState = {
  busyId: string | null;
  error: string | null;
  slotUnavailable: boolean;
  success: string | null;
};

// Secretary appointment management (spec: only the secretary can cancel or
// reschedule after the cancellation window closes). Both actions are POSTs keyed
// by appointment id — no one-time link involved — and report back the refreshed
// appointment so the day list can stay in sync.
export function useAdminAppointmentManagement() {
  const [state, setState] = useState<AppointmentManagementState>({
    busyId: null,
    error: null,
    slotUnavailable: false,
    success: null,
  });

  const begin = useCallback(() => {
    setState({ busyId: null, error: null, slotUnavailable: false, success: null });
  }, []);

  const cancel = useCallback(async (appointmentId: string) => {
    setState((previous) => ({ ...previous, busyId: appointmentId, error: null, success: null }));
    try {
      await apiPost(`/api/admin/appointments/${appointmentId}/cancel`, {});
      setState({
        busyId: null,
        error: null,
        slotUnavailable: false,
        success: "Appointment cancelled.",
      });
      return true;
    } catch (error: unknown) {
      setState((previous) => ({
        ...previous,
        busyId: null,
        error: error instanceof Error ? error.message : "Unexpected error",
      }));
      return false;
    }
  }, []);

  const reschedule = useCallback(async (appointmentId: string, slot: Slot) => {
    setState((previous) => ({ ...previous, busyId: appointmentId, error: null, success: null }));
    try {
      await apiPost(`/api/admin/appointments/${appointmentId}/reschedule`, {
        date: slot.date,
        startTime: slot.startTime,
      });
      setState({
        busyId: null,
        error: null,
        slotUnavailable: false,
        success: `Appointment rescheduled to ${slot.date} at ${slot.startTime}.`,
      });
      return true;
    } catch (error: unknown) {
      // 409 means the slot was taken since the grid loaded; refresh it.
      const slotUnavailable = isConflictError(error);
      setState((previous) => ({
        ...previous,
        busyId: null,
        error: error instanceof Error ? error.message : "Unexpected error",
        slotUnavailable,
      }));
      return false;
    }
  }, []);

  return { ...state, begin, cancel, reschedule };
}