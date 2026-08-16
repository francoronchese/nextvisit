type CancelSectionProps = {
  acting: boolean;
  onCancel: () => void;
};

export function CancelSection({ acting, onCancel }: CancelSectionProps) {
  return (
    <section className="rounded-2xl border-2 border-gray-200 p-6">
      <h3 className="text-xl font-bold text-gray-900">Cancel this appointment</h3>
      <p className="mt-2 text-gray-600">
        You can cancel or reschedule up to 3 hours before the appointment.
      </p>
      <button
        type="button"
        onClick={onCancel}
        disabled={acting}
        className="mt-4 w-full cursor-pointer rounded-2xl border-2 border-red-300 px-4 py-3 text-lg font-medium text-red-800 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {acting ? "Cancelling…" : "Cancel appointment"}
      </button>
    </section>
  );
}