type OptionListProps<T> = {
  options: T[];
  getKey: (option: T) => string;
  getLabel: (option: T) => string;
  loading: boolean;
  error: string | null;
  emptyLabel: string;
  selectedId?: string;
  onSelect: (option: T) => void;
  onRetry: () => void;
};

import { LoadState } from "./LoadState";

export function OptionList<T>({
  options,
  getKey,
  getLabel,
  loading,
  error,
  emptyLabel,
  selectedId,
  onSelect,
  onRetry,
}: OptionListProps<T>) {
  return (
    <LoadState
      loading={loading}
      error={error}
      loadingLabel="Loading…"
      errorLabel="Couldn't load the information."
      onRetry={onRetry}
    >
      {options.length === 0 ? (
        <p className="text-lg text-gray-600">{emptyLabel}</p>
      ) : (
        <div className="grid gap-3">
          {options.map((option) => {
            const selected = selectedId === getKey(option);
            return (
              <button
                key={getKey(option)}
                type="button"
                onClick={() => onSelect(option)}
                aria-pressed={selected}
                className={`w-full cursor-pointer rounded-2xl border-2 p-4 text-left text-lg font-medium transition-colors ${
                  selected
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 bg-white text-gray-900 hover:border-blue-400"
                }`}
              >
                {getLabel(option)}
              </button>
            );
          })}
        </div>
      )}
    </LoadState>
  );
}