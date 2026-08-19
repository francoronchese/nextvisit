import { formatDateLong, utcToClinicParts } from "@nextvisit/shared";
import { LoadState } from "../../../components/LoadState";
import { useDoctorAppointments } from "../hooks/useDoctorAppointments";

// Read-only list of the signed-in doctor's upcoming appointments — no edit,
// cancel, or reschedule actions (spec: the doctor panel is read-only).
export function DoctorAppointments() {
  const list = useDoctorAppointments();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Upcoming appointments</h3>
      <LoadState
        loading={list.loading}
        error={list.error}
        loadingLabel="Loading your appointments…"
        errorLabel="Could not load your appointments."
        onRetry={list.retry}
      >
        {list.data && list.data.length === 0 ? (
          <p className="text-lg text-gray-600">You have no upcoming appointments.</p>
        ) : (
          <ul className="space-y-2">
            {list.data?.map((entry) => {
              const { appointment, patient, appointmentType } = entry;
              const { date, time } = utcToClinicParts(new Date(appointment.startsAt));
              return (
                <li key={appointment.id} className="rounded-2xl border-2 border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-lg font-semibold text-gray-900">
                      {formatDateLong(date)} at {time}
                    </span>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                      {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                    </span>
                  </div>
                  <p className="mt-2 text-gray-900">
                    {patient.firstName} {patient.lastName}
                    <span className="block text-sm text-gray-600">
                      DNI {patient.dni} — {appointmentType.name}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </LoadState>
    </div>
  );
}