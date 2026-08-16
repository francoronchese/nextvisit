import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadState } from "../../../components/LoadState";
import { AppointmentCard } from "../components/AppointmentCard";
import { CancelSection } from "../components/CancelSection";
import { RescheduleSection } from "../components/RescheduleSection";
import { formatAppointmentStart } from "../components/appointmentTime";
import { useAppointment } from "../hooks/useAppointment";
import { useAppointmentActions } from "../hooks/useAppointmentActions";

function tokenFromPath(): string | undefined {
  const match = window.location.pathname.match(/^\/appointments\/([0-9a-f]{32,64})$/);
  return match?.[1];
}

function AppointmentHeader() {
  return (
    <header className="bg-white shadow-sm">
      <div className="mx-auto max-w-2xl px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">Next Visit</h1>
        <p className="text-gray-600">Manage your appointment.</p>
      </div>
    </header>
  );
}

export function AppointmentManagementPage() {
  const token = tokenFromPath();
  const appointment = useAppointment(token);
  const actions = useAppointmentActions(token);

  if (actions.result) {
    return (
      <main className="min-h-screen bg-gray-50">
        <AppointmentHeader />
        <div className="mx-auto max-w-2xl px-4 py-8">
          {actions.result.kind === "cancelled" ? (
            <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-6">
              <h2 className="text-2xl font-bold text-green-900">Your appointment has been cancelled</h2>
              <p className="mt-2 text-lg text-gray-700">
                A confirmation email was sent to the address we have on file.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-6">
              <h2 className="text-2xl font-bold text-green-900">Your appointment has been rescheduled</h2>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {formatAppointmentStart(actions.result.appointment.startsAt)}
              </p>
              <p className="mt-2 text-lg text-gray-700">
                A confirmation email was sent to the address we have on file.
              </p>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <AppointmentHeader />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Manage your appointment</h2>
        {!token && <ErrorBanner>This link looks incomplete. Check the email we sent you.</ErrorBanner>}
        <LoadState
          loading={appointment.loading}
          error={appointment.error}
          loadingLabel="Loading your appointment…"
          errorLabel="We couldn't find your appointment. It may have been cancelled or the link may have expired."
          onRetry={appointment.retry}
        >
          {appointment.data && (
            <div className="grid gap-6">
              <AppointmentCard detail={appointment.data} />
              {actions.error && <ErrorBanner>{actions.error}</ErrorBanner>}
              <CancelSection acting={actions.acting} onCancel={actions.cancel} />
              <RescheduleSection
                doctorId={appointment.data.doctor.id}
                typeId={appointment.data.appointmentType.id}
                acting={actions.acting}
                slotUnavailable={actions.slotUnavailable}
                onReschedule={actions.reschedule}
              />
            </div>
          )}
        </LoadState>
      </div>
    </main>
  );
}