import { useEffect, useState } from "react";
import { LoadState } from "../../../components/LoadState";
import { useAdminDoctors } from "../hooks/useAdminDoctors";
import { BlockSection } from "./BlockSection";
import { WeeklyAvailabilitySection } from "./WeeklyAvailabilitySection";

export function AvailabilityManager() {
  const { data: doctors, loading, error, retry } = useAdminDoctors();
  const [doctorId, setDoctorId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!doctorId && doctors && doctors.length > 0) {
      setDoctorId(doctors[0]!.id);
    }
  }, [doctorId, doctors]);

  return (
    <div className="space-y-6">
      <LoadState
        loading={loading}
        error={error}
        loadingLabel="Loading doctors…"
        errorLabel="Could not load doctors."
        onRetry={retry}
      >
        <label className="block">
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
          <>
            <WeeklyAvailabilitySection doctorId={doctorId} />
            <BlockSection doctorId={doctorId} />
          </>
        )}
      </LoadState>
    </div>
  );
}
