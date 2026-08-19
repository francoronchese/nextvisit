import { useState, type FormEvent } from "react";
import type { StaffRole, User } from "../admin.types";
import { LoadState } from "../../../components/LoadState";
import { useAdminDoctors } from "../hooks/useAdminDoctors";
import { useAdminUsers } from "../hooks/useAdminUsers";

const ROLE_LABELS: Record<User["role"], string> = {
  admin: "Admin",
  secretary: "Secretary",
  doctor: "Doctor",
};

export function UserManager() {
  const users = useAdminUsers();
  const doctors = useAdminDoctors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("secretary");
  const [doctorId, setDoctorId] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await users.create({
      email,
      password,
      role,
      ...(role === "doctor" && doctorId ? { doctorId } : {}),
    });
    if (created) {
      setEmail("");
      setPassword("");
      setDoctorId("");
    }
  };

  const doctorFor = (user: User) =>
    user.doctorId ? doctors.data?.find((doctor) => doctor.id === user.doctorId) : undefined;

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border-2 border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Create credentials</h3>
        <div>
          <label htmlFor="user-email" className="mb-1 block text-lg text-gray-700">
            Email
          </label>
          <input
            id="user-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="user-password" className="mb-1 block text-lg text-gray-700">
            Password
          </label>
          <input
            id="user-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="user-role" className="mb-1 block text-lg text-gray-700">
            Role
          </label>
          <select
            id="user-role"
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
            className="w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
          >
            <option value="secretary">Secretary</option>
            <option value="doctor">Doctor</option>
          </select>
        </div>
        {role === "doctor" && (
          <div>
            <label htmlFor="user-doctor" className="mb-1 block text-lg text-gray-700">
              Doctor
            </label>
            <LoadState
              loading={doctors.loading}
              error={doctors.error}
              loadingLabel="Loading doctors…"
              errorLabel="Could not load doctors."
              onRetry={doctors.retry}
            >
              <select
                id="user-doctor"
                required
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
                className="w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
              >
                <option value="">Select a doctor…</option>
                {doctors.data?.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.firstName} {doctor.lastName}
                  </option>
                ))}
              </select>
            </LoadState>
          </div>
        )}
        {users.createError && (
          <div role="alert" className="text-lg text-red-700">
            {users.createError}
          </div>
        )}
        <button
          type="submit"
          disabled={users.submitting}
          className="w-full cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {users.submitting ? "Creating…" : "Create credentials"}
        </button>
      </form>

      <div>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Staff</h3>
        <LoadState
          loading={users.loading}
          error={users.error}
          loadingLabel="Loading staff…"
          errorLabel="Could not load staff."
          onRetry={users.retry}
        >
          {users.data && users.data.length === 0 ? (
            <p className="text-lg text-gray-600">No staff users yet.</p>
          ) : (
            <ul className="space-y-2">
              {users.data?.map((user) => {
                const doctor = doctorFor(user);
                return (
                  <li
                    key={user.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border-2 border-gray-200 bg-white p-4"
                  >
                    <span className="text-lg text-gray-900">{user.email}</span>
                    <span className="flex items-center gap-2">
                      {user.role === "doctor" && doctor && (
                        <span className="text-sm text-gray-600">
                          {doctor.firstName} {doctor.lastName}
                        </span>
                      )}
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                        {ROLE_LABELS[user.role]}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </LoadState>
      </div>
    </div>
  );
}