import { useEffect, useState } from "react";
import { utcToClinicParts } from "@nextvisit/shared";
import { LoadState } from "../../../components/LoadState";
import type { AppointmentDetailWithInsurance } from "../admin.types";
import { useDayAppointments } from "../hooks/useDayAppointments";
import { useRecordAttendance } from "../hooks/useRecordAttendance";
import { AttendanceForm } from "./AttendanceForm";

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
  const day = useDayAppointments(date);
  const record = useRecordAttendance();

  // A different day invalidates the appointment currently open in the form.
  useEffect(() => {
    setSelected(undefined);
  }, [date]);

  const handleRecorded = () => {
    setSelected(undefined);
    day.retry();
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
            {day.data?.map((record) => {
              const { appointment, patient, doctor, appointmentType } = record;
              const time = utcToClinicParts(new Date(appointment.startsAt)).time;
              const attended = appointment.attendance === "attended";
              return (
                <li key={appointment.id}>
                  <button
                    type="button"
                    disabled={attended}
                    onClick={() => setSelected(record)}
                    aria-pressed={selected?.appointment.id === appointment.id}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-gray-200 bg-white p-4 text-left hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
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
                </li>
              );
            })}
          </ul>
        )}
      </LoadState>

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
          {record.recorded.attendance === "attended"
            ? `${record.recorded.copayPaid ? "Copay paid" : "Copay not paid"} — appointment marked attended.`
            : "Appointment marked."}
        </p>
      )}
    </div>
  );
}