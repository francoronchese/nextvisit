import { useState } from "react";
import type { FormEvent } from "react";
import type { Availability, AvailabilityInput } from "../admin.types";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadState } from "../../../components/LoadState";
import { useAvailability } from "../hooks/useAvailability";
import { END_TIME_AFTER_START_ERROR, TimeRangeFields } from "./TimeRangeFields";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday - 1] ?? `Day ${weekday}`;
}

type WeeklyAvailabilitySectionProps = {
  doctorId: string;
};

export function WeeklyAvailabilitySection({ doctorId }: WeeklyAvailabilitySectionProps) {
  const { weeklyHours, loading, error, retry, addWindow, updateWindow, removeWindow } =
    useAvailability(doctorId);
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const startEditing = (window: Availability) => {
    setEditingId(window.id);
    setWeekday(window.weekday);
    setStartTime(window.startTime);
    setEndTime(window.endTime);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    if (endTime <= startTime) {
      setSubmitError(END_TIME_AFTER_START_ERROR);
      return;
    }
    setSubmitting(true);
    const input: AvailabilityInput = { doctorId, weekday, startTime, endTime };
    try {
      if (editingId) {
        await updateWindow(editingId, input);
        setEditingId(null);
      } else {
        await addWindow(input);
      }
    } catch (submitError: unknown) {
      setSubmitError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border-2 border-gray-200 p-4">
      <h3 className="text-xl font-bold text-gray-900">Weekly hours</h3>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-lg text-gray-700">Day</span>
          <select
            value={weekday}
            onChange={(event) => setWeekday(Number(event.target.value))}
            className="rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
          >
            {WEEKDAYS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <TimeRangeFields
          startTime={startTime}
          endTime={endTime}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
        />
        <button
          type="submit"
          disabled={submitting}
          className="cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : editingId ? "Save changes" : "Add weekly hours"}
        </button>
      </form>
      {submitError && <ErrorBanner>{submitError}</ErrorBanner>}
      <LoadState
        loading={loading}
        error={error}
        loadingLabel="Loading weekly hours…"
        errorLabel="Could not load weekly hours."
        onRetry={retry}
      >
        {weeklyHours.length === 0 ? (
          <p className="mt-4 text-lg text-gray-600">No weekly hours set for this doctor yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {weeklyHours.map((window) => (
              <li key={window.id} className="flex items-center justify-between gap-4">
                <span className="text-lg text-gray-900">
                  {weekdayName(window.weekday)} {window.startTime}–{window.endTime}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEditing(window)}
                    className="cursor-pointer rounded-2xl border-2 border-gray-200 px-3 py-1 font-medium text-gray-900 hover:border-blue-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeWindow(window.id)}
                    className="cursor-pointer rounded-2xl border-2 border-red-200 px-3 py-1 font-medium text-red-700 hover:border-red-500"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </LoadState>
    </section>
  );
}