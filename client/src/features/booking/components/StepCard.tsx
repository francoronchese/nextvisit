import type { ReactNode } from "react";

type StepCardProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
};

export function StepCard({ title, subtitle, onBack, children }: StepCardProps) {
  return (
    <section aria-label={title}>
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="mt-1 text-lg text-gray-600">{subtitle}</p>}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-4 cursor-pointer text-lg font-medium text-blue-700 hover:underline"
        >
          ← Back
        </button>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}