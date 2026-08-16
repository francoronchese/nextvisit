type ErrorBannerProps = {
  children: string;
};

export function ErrorBanner({ children }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="mt-6 rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-lg text-red-800"
    >
      {children}
    </div>
  );
}