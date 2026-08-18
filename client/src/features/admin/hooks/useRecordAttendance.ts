import { useCallback, useState } from "react";
import type { Appointment } from "@nextvisit/shared";
import { apiPatch } from "../../../services/apiClient";

export type AttendancePayload = {
  // Always "attended": no-show is automatic (ADR-0004); the secretary only
  // flips it back, so this endpoint never records a no-show.
  attendance: "attended";
  copayAmount: number;
  copayPaid: boolean;
};

export type RecordAttendanceState = {
  submitting: boolean;
  error: string | null;
  recorded: Appointment | null;
};

export function useRecordAttendance() {
  const [state, setState] = useState<RecordAttendanceState>({
    submitting: false,
    error: null,
    recorded: null,
  });

  const record = useCallback(async (appointmentId: string, payload: AttendancePayload) => {
    setState({ submitting: true, error: null, recorded: null });
    try {
      const appointment = await apiPatch<Appointment>(
        `/api/admin/appointments/${appointmentId}`,
        payload
      );
      setState({ submitting: false, error: null, recorded: appointment });
    } catch (error: unknown) {
      setState({
        submitting: false,
        error: error instanceof Error ? error.message : "Unexpected error",
        recorded: null,
      });
    }
  }, []);

  return { ...state, record };
}