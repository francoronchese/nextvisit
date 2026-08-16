import { useMemo } from "react";
import { formatDateShort } from "@nextvisit/shared";
import type { Slot } from "../booking.types";
import { LoadState } from "../../../components/LoadState";

type SlotGridProps = {
  slots: Slot[];
  loading: boolean;
  error: string | null;
  selectedSlot?: Slot;
  onSelect: (slot: Slot) => void;
  onRetry: () => void;
};

function groupByDate(slots: Slot[]): { date: string; slots: Slot[] }[] {
  const byDate = new Map<string, Slot[]>();
  for (const slot of slots) {
    const group = byDate.get(slot.date) ?? [];
    group.push(slot);
    byDate.set(slot.date, group);
  }
  return [...byDate.entries()].map(([date, daySlots]) => ({ date, slots: daySlots }));
}

export function SlotGrid({ slots, loading, error, selectedSlot, onSelect, onRetry }: SlotGridProps) {
  const days = useMemo(() => groupByDate(slots), [slots]);

  return (
    <LoadState
      loading={loading}
      error={error}
      loadingLabel="Loading available slots…"
      errorLabel="Couldn't load the available slots."
      onRetry={onRetry}
    >
      {days.length === 0 ? (
        <p className="text-lg text-gray-600">No available slots.</p>
      ) : (
        <div className="grid gap-6">
          {days.map((day) => {
            const label = formatDateShort(day.date);
            const isSelected = (slot: Slot) =>
              selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;
            return (
              <section key={day.date} aria-label={label}>
                <h3 className="mb-3 text-lg font-semibold text-gray-900">{label}</h3>
                <div className="grid grid-cols-4 gap-2">
                  {day.slots.map((slot) => (
                    <button
                      key={`${slot.date}-${slot.startTime}`}
                      type="button"
                      disabled={!slot.available}
                      aria-disabled={slot.available ? undefined : true}
                      aria-pressed={isSelected(slot)}
                      onClick={() => onSelect(slot)}
                      className={`rounded-xl border-2 px-2 py-2 text-center text-sm font-medium transition-colors ${
                        !slot.available
                          ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                          : isSelected(slot)
                            ? "border-blue-600 bg-blue-50 text-blue-900"
                            : "border-blue-400 bg-white text-blue-700 hover:border-blue-600 hover:bg-blue-50"
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </LoadState>
  );
}