import { useState } from "react";
import type { FormEvent } from "react";
import type { AvailabilityBlockInput } from "../admin.types";
import { formatDateShort } from "@nextvisit/shared";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadState } from "../../../components/LoadState";
import { useAvailabilityBlocks } from "../hooks/useAvailabilityBlocks";

const BLOCK_REASONS = ["holiday", "absence"] as const;

type BlockSectionProps = {
  doctorId: string;
};

export function BlockSection({ doctorId }: BlockSectionProps) {
  const { blocks, loading, error, retry, addBlock, removeBlock } = useAvailabilityBlocks(doctorId);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState<string>("holiday");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    if (endTime <= startTime) {
      setSubmitError("End time must be after start time.");
      return;
    }
    setSubmitting(true);
    const input: AvailabilityBlockInput = { doctorId, date, startTime, endTime, reason };
    try {
      await addBlock(input);
      setDate("");
    } catch (submitError: unknown) {
      setSubmitError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border-2 border-gray-200 p-4">
      <h3 className="text-xl font-bold text-gray-900">Holidays and absences</h3>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-lg text-gray-700">Date</span>
          <input
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-lg text-gray-700">Start</span>
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-lg text-gray-700">End</span>
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-lg text-gray-700">Reason</span>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
          >
            {BLOCK_REASONS.map((blockReason) => (
              <option key={blockReason} value={blockReason}>
                {blockReason.charAt(0).toUpperCase() + blockReason.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Add block"}
        </button>
      </form>
      {submitError && <ErrorBanner>{submitError}</ErrorBanner>}
      <LoadState
        loading={loading}
        error={error}
        loadingLabel="Loading blocks…"
        errorLabel="Could not load blocks."
        onRetry={retry}
      >
        {blocks.length === 0 ? (
          <p className="mt-4 text-lg text-gray-600">No holidays or absences set for this doctor.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {blocks.map((block) => (
              <li key={block.id} className="flex items-center justify-between gap-4">
                <span className="text-lg text-gray-900">
                  {formatDateShort(block.date)} {block.startTime}–{block.endTime}
                  {block.reason ? ` — ${block.reason}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void removeBlock(block.id)}
                  className="cursor-pointer rounded-2xl border-2 border-red-200 px-3 py-1 font-medium text-red-700 hover:border-red-500"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </LoadState>
    </section>
  );
}