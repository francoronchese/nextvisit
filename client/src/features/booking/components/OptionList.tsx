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
  if (loading) {
    return <p className="text-lg text-gray-600">Loading…</p>;
  }
  if (error) {
    return (
      <div role="alert" className="text-lg text-red-700">
        <p>Couldn't load the information.</p>
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
  if (options.length === 0) {
    return <p className="text-lg text-gray-600">{emptyLabel}</p>;
  }
  return (
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
  );
}