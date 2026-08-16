import { useEffect, useState } from "react";
import type { Slot } from "@nextvisit/shared";
import { useSlots } from "../../booking";
import type { ReschedulePayload } from "../appointments.types";
import { SlotGrid } from "../../booking";

type RescheduleSectionProps = {
  doctorId: string;
  typeId: string;
  acting: boolean;
  slotUnavailable: boolean;
  onReschedule: (payload: ReschedulePayload) => void;
};

export function RescheduleSection({
  doctorId,
  typeId,
  acting,
  slotUnavailable,
  onReschedule,
}: RescheduleSectionProps) {
  const [selectedSlot, setSelectedSlot] = useState<Slot>();
  const slots = useSlots(doctorId, typeId);

  // The chosen slot was taken by someone else: refresh the grid and clear the pick.
  useEffect(() => {
    if (slotUnavailable) {
      setSelectedSlot(undefined);
      slots.retry();
    }
  }, [slotUnavailable, slots.retry]);

  return (
    <section className="rounded-2xl border-2 border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900">Reschedule</h3>
      <p className="mt-2 text-gray-600">Pick a new time for your appointment.</p>
      <div className="mt-4">
        <SlotGrid
          slots={slots.data ?? []}
          loading={slots.loading}
          error={slots.error}
          selectedSlot={selectedSlot}
          onSelect={setSelectedSlot}
          onRetry={slots.retry}
        />
      </div>
      {selectedSlot && (
        <button
          type="button"
          onClick={() =>
            onReschedule({ date: selectedSlot.date, startTime: selectedSlot.startTime })
          }
          disabled={acting}
          className="mt-4 w-full cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {acting ? "Rescheduling…" : `Reschedule to ${selectedSlot.startTime}`}
        </button>
      )}
    </section>
  );
}