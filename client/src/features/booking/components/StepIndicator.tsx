type StepIndicatorProps = {
  labels: readonly string[];
  current: number;
};

export function StepIndicator({ labels, current }: StepIndicatorProps) {
  return (
    <ol aria-label="Progress" className="mb-8 flex flex-wrap items-center justify-center gap-2">
      {labels.map((label, index) => {
        const state =
          index === current
            ? "bg-blue-700 text-white"
            : index < current
              ? "bg-blue-100 text-blue-800"
              : "bg-gray-100 text-gray-500";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={index === current ? "step" : undefined}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${state}`}
            >
              {index + 1}. {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}