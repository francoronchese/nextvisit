import type { AppointmentType, Doctor, Patient, Slot, Specialty } from "../booking.types";

type ConfirmationProps = {
  patient: Patient;
  specialty: Specialty;
  type: AppointmentType;
  doctor: Doctor;
  slot: Slot;
};

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Confirmation({ patient, specialty, type, doctor, slot }: ConfirmationProps) {
  return (
    <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-6">
      <h2 className="text-2xl font-bold text-green-900">Your appointment is confirmed</h2>
      <p className="mt-2 text-lg text-gray-700">
        {patient.firstName} {patient.lastName} — {doctor.firstName} {doctor.lastName},{" "}
        {specialty.name} ({type.name})
      </p>
      <p className="mt-4 text-2xl font-semibold text-gray-900">
        {formatDate(slot.date)} at {slot.startTime}
      </p>
      <p className="mt-4 text-lg text-gray-700">
        A confirmation email was sent to {patient.email}.
      </p>
    </div>
  );
}