import { useAdminLogin } from "../hooks/useAdminLogin";
import { AvailabilityManager } from "../components/AvailabilityManager";
import { LoginForm } from "../components/LoginForm";

export function AdminLoginPage() {
  const { user, loading, error, login, logout } = useAdminLogin();

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">Next Visit — Admin</h1>
          <p className="text-gray-600">Staff access for secretary, doctor, and admin.</p>
        </div>
      </header>
      {user ? (
        user.role === "secretary" ? (
          <AvailabilityManager user={user} onLogout={logout} />
        ) : (
          <div className="mx-auto max-w-2xl px-4 py-8">
            <p className="text-lg text-gray-700">
              Welcome back, {user.email} ({user.role}).
            </p>
            <button
              type="button"
              onClick={logout}
              className="mt-4 cursor-pointer rounded-2xl border-2 border-gray-200 px-4 py-2 font-medium text-gray-900 hover:border-blue-400"
            >
              Sign out
            </button>
          </div>
        )
      ) : (
        <div className="mx-auto max-w-md px-4 py-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Sign in</h2>
          <LoginForm loading={loading} error={error} onLogin={login} />
        </div>
      )}
    </main>
  );
}