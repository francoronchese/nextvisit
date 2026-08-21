import { useEffect, useState } from "react";
import { utcToClinicParts, type Slot } from "@nextvisit/shared";
import { LoadState } from "../../../components/LoadState";
import type { AppointmentDetailWithInsurance } from "../admin.types";
import { useAdminAppointmentManagement } from "../hooks/useAdminAppointmentManagement";
import { useDayAppointments } from "../hooks/useDayAppointments";
import { useRecordAttendance } from "../hooks/useRecordAttendance";
import { AttendanceForm } from "./AttendanceForm";
import { ReschedulePanel } from "./ReschedulePanel";

const ATTENDANCE_LABELS: Record<string, string> = {
  pending: "Pending",
  attended: "Attended",
  no_show: "No-show",
};

const ATTENDANCE_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  attended: "bg-green-100 text-green-800",
  no_show: "bg-amber-100 text-amber-800",
};

export function AttendanceManager() {
  const [date, setDate] = useState(utcToClinicParts(new Date()).date);
  const [selected, setSelected] = useState<AppointmentDetailWithInsurance>();
  const [rescheduling, setRescheduling] = useState<AppointmentDetailWithInsurance>();
  const day = useDayAppointments(date);
  const record = useRecordAttendance();
  const management = useAdminAppointmentManagement();

  // A different day invalidates the appointment currently open in the form and
  // any in-flight reschedule/cancel notice.
  useEffect(() => {
    setSelected(undefined);
    setRescheduling(undefined);
    management.begin();
  }, [date]);

  const handleRecorded = () => {
    setSelected(undefined);
    day.retry();
  };

  const handleCancel = async (entry: AppointmentDetailWithInsurance) => {
    const { appointment, patient } = entry;
    const time = utcToClinicParts(new Date(appointment.startsAt)).time;
    const confirmed = window.confirm(
      `Cancel the appointment for ${patient.firstName} ${patient.lastName} at ${time}?`
    );
    if (!confirmed) return;
    const ok = await management.cancel(appointment.id);
    if (ok) day.retry();
  };

  const handleReschedule = async (entry: AppointmentDetailWithInsurance, slot: Slot) => {
    const ok = await management.reschedule(entry.appointment.id, slot);
    if (ok) {
      setRescheduling(undefined);
      day.retry();
    }
  };

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="mb-1 block text-lg text-gray-700">Date</span>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
        />
      </label>

      <LoadState
        loading={day.loading}
        error={day.error}
        loadingLabel="Loading appointments…"
        errorLabel="Could not load appointments."
        onRetry={day.retry}
      >
        {day.data && day.data.length === 0 ? (
          <p className="text-lg text-gray-600">No appointments for this day.</p>
        ) : (
          <ul className="space-y-2">
            {day.data?.map((entry) => {
              const { appointment, patient, doctor, appointmentType } = entry;
              const time = utcToClinicParts(new Date(appointment.startsAt)).time;
              const attended = appointment.attendance === "attended";
              return (
                <li
                  key={appointment.id}
                  className="flex items-center gap-2 rounded-2xl border-2 border-gray-200 bg-white p-4"
                >
                  <button
                    type="button"
                    disabled={attended}
                    onClick={() => {
                      record.clear();
                      management.begin();
                      setRescheduling(undefined);
                      setSelected(entry);
                    }}
                    aria-pressed={selected?.appointment.id === appointment.id}
                    className="flex flex-1 cursor-pointer items-center justify-between gap-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="text-lg font-semibold text-gray-900">{time}</span>
                    <span className="flex-1 text-gray-900">
                      {patient.firstName} {patient.lastName}
                      <span className="block text-sm text-gray-600">
                        {doctor.firstName} {doctor.lastName} — {appointmentType.name}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${ATTENDANCE_STYLES[appointment.attendance]}`}
                    >
                      {ATTENDANCE_LABELS[appointment.attendance]}
                    </span>
                  </button>
                  {appointment.status === "scheduled" && !attended && (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          record.clear();
                          management.begin();
                          setSelected(undefined);
                          setRescheduling(entry);
                        }}
                        className="cursor-pointer rounded-xl border-2 border-blue-200 px-3 py-1 text-sm font-semibold text-blue-700 hover:border-blue-400"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        disabled={management.busyId === appointment.id}
                        onClick={() => handleCancel(entry)}
                        className="cursor-pointer rounded-xl border-2 border-red-200 px-3 py-1 text-sm font-semibold text-red-700 hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </LoadState>

      {management.success && !rescheduling && !selected && (
        <p className="rounded-2xl border-2 border-green-200 bg-green-50 p-4 text-lg text-green-900">
          {management.success}
        </p>
      )}

      {rescheduling && (
        <ReschedulePanel
          record={rescheduling}
          busy={management.busyId === rescheduling.appointment.id}
          error={management.error}
          slotUnavailable={management.slotUnavailable}
          onSubmit={(slot) => handleReschedule(rescheduling, slot)}
          onClose={() => setRescheduling(undefined)}
        />
      )}

      {selected && !record.recorded && (
        <AttendanceForm
          record={selected}
          submitting={record.submitting}
          error={record.error}
          onSubmit={(payload) => record.record(selected.appointment.id, payload).then(handleRecorded)}
        />
      )}
      {!selected && record.recorded && (
        <p className="rounded-2xl border-2 border-green-200 bg-green-50 p-4 text-lg text-green-900">
          {record.recorded.copayPaid ? "Copay paid" : "Copay not paid"} — appointment marked
          attended.
        </p>
      )}
    </div>
  );
}