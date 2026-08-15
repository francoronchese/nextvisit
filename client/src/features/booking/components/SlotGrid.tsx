import { useMemo } from "react";
import type { Slot } from "../booking.types";

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

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  const parts = new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return parts.charAt(0).toUpperCase() + parts.slice(1);
}

export function SlotGrid({ slots, loading, error, selectedSlot, onSelect, onRetry }: SlotGridProps) {
  const days = useMemo(() => groupByDate(slots), [slots]);

  if (loading) {
    return <p className="text-lg text-gray-600">Loading available slots…</p>;
  }
  if (error) {
    return (
      <div role="alert" className="text-lg text-red-700">
        <p>Couldn't load the available slots.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 cursor-pointer rounded-2xl border-2 border-red-300 px-4 py-2 font-medium text-gray-900 hover:border-red-500"
        >
          Retry
        </button>
      </div>
    );
  }
  if (days.length === 0) {
    return <p className="text-lg text-gray-600">No available slots.</p>;
  }

  return (
    <div className="grid gap-6">
      {days.map((day) => {
        const isSelected = (slot: Slot) =>
          selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;
        return (
          <section key={day.date} aria-label={formatDate(day.date)}>
            <h3 className="mb-3 text-lg font-semibold text-gray-900">{formatDate(day.date)}</h3>
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
  );
}