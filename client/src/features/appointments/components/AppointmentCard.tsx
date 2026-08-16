import type { AppointmentDetail } from "../appointments.types";
import { formatAppointmentStart } from "./appointmentTime";

export function AppointmentCard({ detail }: { detail: AppointmentDetail }) {
  const { appointment, patient, doctor, specialty, appointmentType } = detail;
  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6">
      <h2 className="text-2xl font-bold text-blue-900">Your appointment</h2>
      <p className="mt-2 text-lg text-gray-700">
        {patient.firstName} {patient.lastName} — {doctor.firstName} {doctor.lastName},{" "}
        {specialty.name} ({appointmentType.name})
      </p>
      <p className="mt-4 text-2xl font-semibold text-gray-900">
        {formatAppointmentStart(appointment.startsAt)}
      </p>
    </div>
  );
}