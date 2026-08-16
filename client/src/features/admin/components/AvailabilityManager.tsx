import { useEffect, useState } from "react";
import type { User } from "@nextvisit/shared";
import { LoadState } from "../../../components/LoadState";
import { useAdminDoctors } from "../hooks/useAdminDoctors";
import { BlockSection } from "./BlockSection";
import { WeeklyAvailabilitySection } from "./WeeklyAvailabilitySection";

type AvailabilityManagerProps = {
  user: User;
  onLogout: () => void;
};

export function AvailabilityManager({ user, onLogout }: AvailabilityManagerProps) {
  const { data: doctors, loading, error, retry } = useAdminDoctors();
  const [doctorId, setDoctorId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!doctorId && doctors && doctors.length > 0) {
      setDoctorId(doctors[0]!.id);
    }
  }, [doctorId, doctors]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Availability</h2>
        <button
          type="button"
          onClick={onLogout}
          className="cursor-pointer rounded-2xl border-2 border-gray-200 px-4 py-2 font-medium text-gray-900 hover:border-blue-400"
        >
          Sign out
        </button>
      </div>
      <p className="mb-4 text-lg text-gray-600">
        Signed in as {user.email} ({user.role}).
      </p>

      <LoadState
        loading={loading}
        error={error}
        loadingLabel="Loading doctors…"
        errorLabel="Could not load doctors."
        onRetry={retry}
      >
        <label className="mb-6 block">
          <span className="mb-1 block text-lg text-gray-700">Doctor</span>
          <select
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
            className="w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
          >
            {doctors?.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.firstName} {doctor.lastName}
              </option>
            ))}
          </select>
        </label>
        {doctorId && (
          <div className="space-y-6">
            <WeeklyAvailabilitySection doctorId={doctorId} />
            <BlockSection doctorId={doctorId} />
          </div>
        )}
      </LoadState>
    </div>
  );
}