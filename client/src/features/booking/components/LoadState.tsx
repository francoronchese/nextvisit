import type { ReactNode } from "react";

type LoadStateProps = {
  loading: boolean;
  error: string | null;
  loadingLabel: string;
  errorLabel: string;
  onRetry: () => void;
  children: ReactNode;
};

export function LoadState({
  loading,
  error,
  loadingLabel,
  errorLabel,
  onRetry,
  children,
}: LoadStateProps) {
  if (loading) {
    return <p className="text-lg text-gray-600">{loadingLabel}</p>;
  }
  if (error) {
    return (
      <div role="alert" className="text-lg text-red-700">
        <p>{errorLabel}</p>
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
  return children;
}