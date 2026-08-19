import { useState, type FormEvent } from "react";
import type { HealthInsurance } from "../admin.types";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadState } from "../../../components/LoadState";
import { useAdminHealthInsurances } from "../hooks/useAdminHealthInsurances";

const inputClass =
  "w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none";

function formatCopay(amount: number): string {
  return `$${amount.toLocaleString("es-AR")}`;
}

function parseCopay(value: string): number | undefined {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export function HealthInsuranceManager() {
  const { insurances, loading, error, retry, create, update, remove } =
    useAdminHealthInsurances();
  const [name, setName] = useState("");
  const [copayAmount, setCopayAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCopay, setEditCopay] = useState("");

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = parseCopay(copayAmount);
    if (amount === undefined) {
      setActionError("Enter a valid copay amount");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await create({ name, copayAmount: amount });
      setName("");
      setCopayAmount("");
    } catch (submitError: unknown) {
      setActionError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (insurance: HealthInsurance) => {
    setEditingId(insurance.id);
    setEditName(insurance.name);
    setEditCopay(String(insurance.copayAmount));
    setActionError(null);
  };

  const handleSaveEdit = async (insurance: HealthInsurance) => {
    const amount = parseCopay(editCopay);
    if (amount === undefined) {
      setActionError("Enter a valid copay amount");
      return;
    }
    setActionError(null);
    try {
      await update(insurance.id, { name: editName, copayAmount: amount });
      setEditingId(null);
    } catch (submitError: unknown) {
      setActionError(submitError instanceof Error ? submitError.message : "Unexpected error");
    }
  };

  const handleDelete = async (insurance: HealthInsurance) => {
    setActionError(null);
    try {
      await remove(insurance.id);
    } catch (submitError: unknown) {
      setActionError(submitError instanceof Error ? submitError.message : "Unexpected error");
    }
  };

  return (
    <section className="space-y-8">
      <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border-2 border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Health insurance copays</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1">
            <span className="mb-1 block text-lg text-gray-700">Insurance name</span>
            <input
              id="insurance-name"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-lg text-gray-700">Copay amount</span>
            <input
              id="insurance-copay"
              type="number"
              required
              min={0}
              step="0.01"
              value={copayAmount}
              onChange={(event) => setCopayAmount(event.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add insurance"}
          </button>
        </div>
      </form>
      {actionError && <ErrorBanner>{actionError}</ErrorBanner>}
      <LoadState
        loading={loading}
        error={error}
        loadingLabel="Loading health insurances…"
        errorLabel="Could not load health insurances."
        onRetry={retry}
      >
        {insurances.length === 0 ? (
          <p className="text-lg text-gray-600">No health insurances yet.</p>
        ) : (
          <ul className="space-y-2">
            {insurances.map((insurance) =>
              editingId === insurance.id ? (
                <li
                  key={insurance.id}
                  className="flex flex-wrap items-end gap-3 rounded-2xl border-2 border-blue-300 bg-white p-4"
                >
                  <label className="block flex-1">
                    <span className="mb-1 block text-lg text-gray-700">Insurance name</span>
                    <input
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-lg text-gray-700">Copay amount</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editCopay}
                      onChange={(event) => setEditCopay(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit(insurance)}
                      className="cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="cursor-pointer rounded-2xl border-2 border-gray-200 px-4 py-3 font-medium text-gray-900 hover:border-blue-400"
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  key={insurance.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border-2 border-gray-200 bg-white p-4"
                >
                  <span className="text-lg text-gray-900">{insurance.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-lg text-gray-600">{formatCopay(insurance.copayAmount)}</span>
                    <button
                      type="button"
                      onClick={() => startEditing(insurance)}
                      className="cursor-pointer rounded-2xl border-2 border-gray-200 px-3 py-1 font-medium text-gray-900 hover:border-blue-400"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(insurance)}
                      className="cursor-pointer rounded-2xl border-2 border-red-200 px-3 py-1 font-medium text-red-700 hover:border-red-500"
                    >
                      Delete
                    </button>
                  </span>
                </li>
              )
            )}
          </ul>
        )}
      </LoadState>
    </section>
  );
}
