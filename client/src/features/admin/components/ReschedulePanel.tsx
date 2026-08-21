import { useEffect, useState } from "react";
import { formatDateLong, utcToClinicParts, type Slot } from "@nextvisit/shared";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { SlotGrid } from "../../booking";
import { useSlots } from "../../booking";
import type { AppointmentDetailWithInsurance } from "../admin.types";

type ReschedulePanelProps = {
  record: AppointmentDetailWithInsurance;
  busy: boolean;
  error: string | null;
  slotUnavailable: boolean;
  onSubmit: (slot: Slot) => void;
  onClose: () => void;
};

// The secretary picks a new slot for an existing appointment; the doctor and
// appointment type stay the ones booked (the server only moves the slot).
export function ReschedulePanel({
  record,
  busy,
  error,
  slotUnavailable,
  onSubmit,
  onClose,
}: ReschedulePanelProps) {
  const { appointment, patient, doctor, appointmentType } = record;
  const [selected, setSelected] = useState<Slot>();
  const slots = useSlots(doctor.id, appointmentType.id);
  const current = utcToClinicParts(new Date(appointment.startsAt));

  // A slot taken by someone else needs a fresh grid and a cleared pick.
  useEffect(() => {
    if (slotUnavailable) {
      setSelected(undefined);
      slots.retry();
    }
  }, [slotUnavailable, slots]);

  return (
    <section
      aria-label={`Reschedule ${patient.firstName} ${patient.lastName}`}
      className="rounded-2xl border-2 border-gray-200 bg-white p-6"
    >
      <h3 className="text-xl font-bold text-gray-900">
        Reschedule {patient.firstName} {patient.lastName}
      </h3>
      <p className="mb-4 mt-1 text-lg text-gray-600">
        {doctor.firstName} {doctor.lastName} — {appointmentType.name}, currently{" "}
        {formatDateLong(current.date)} at {current.time}.
      </p>

      <SlotGrid
        slots={slots.data ?? []}
        loading={slots.loading}
        error={slots.error}
        selectedSlot={selected}
        onSelect={setSelected}
        onRetry={slots.retry}
      />
      {slotUnavailable && <ErrorBanner>{`${error} Please pick another time.`}</ErrorBanner>}
      {!slotUnavailable && error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-2xl border-2 border-gray-200 px-4 py-2 font-medium text-gray-900 hover:border-blue-400"
        >
          Close
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onSubmit(selected)}
            disabled={busy}
            className="flex-1 cursor-pointer rounded-2xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Rescheduling…" : `Reschedule to ${selected.startTime}`}
          </button>
        )}
      </div>
    </section>
  );
}