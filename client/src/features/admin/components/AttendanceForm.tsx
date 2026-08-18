import { useState } from "react";
import type { FormEvent } from "react";
import type { AppointmentDetailWithInsurance } from "../admin.types";
import type { AttendancePayload } from "../hooks/useRecordAttendance";

type AttendanceFormProps = {
  record: AppointmentDetailWithInsurance;
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: AttendancePayload) => void;
};

export function AttendanceForm({ record, submitting, error, onSubmit }: AttendanceFormProps) {
  const { appointment, patient, doctor, appointmentType, insurance } = record;
  // The booking flow records the insurance copay on the appointment, so the
  // amount shown is the one fixed at booking; editing the insurance later must
  // not silently change what this patient is charged (spec: the appointment
  // carries the copay). The secretary only confirms or adjusts it.
  const [copayAmount, setCopayAmount] = useState(String(appointment.copayAmount));
  const [copayPaid, setCopayPaid] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const attended = appointment.attendance === "attended";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = copayAmount.trim();
    const amount = raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      setAmountError("Enter a valid copay amount");
      return;
    }
    setAmountError(null);
    onSubmit({ attendance: "attended", copayAmount: amount, copayPaid });
  };

  return (
    <div className="mt-6 rounded-2xl border-2 border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900">
          {patient.firstName} {patient.lastName} ({patient.dni})
        </h3>
        <p className="text-lg text-gray-600">
          {appointmentType.name} with {doctor.firstName} {doctor.lastName}
        </p>
      </div>

      {attended ? (
        <p className="text-lg text-green-700">This appointment is already marked attended.</p>
      ) : (
        <>
          {appointment.attendance === "no_show" && (
            <p className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 text-amber-800">
              This patient was marked no-show automatically. Marking attended corrects it.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-lg text-gray-700">
                Copay (booked from {insurance.name})
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={copayAmount}
                onChange={(event) => setCopayAmount(event.target.value)}
                aria-invalid={amountError !== null}
                className="w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
              />
              {amountError && (
                <p role="alert" className="mt-1 text-lg text-red-700">
                  {amountError}
                </p>
              )}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-lg text-gray-900">
              <input
                type="checkbox"
                checked={copayPaid}
                onChange={(event) => setCopayPaid(event.target.checked)}
                className="h-5 w-5"
              />
              Copay paid
            </label>
            {error && <div role="alert" className="text-lg text-red-700">{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Recording…" : "Mark attended & record copay"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}