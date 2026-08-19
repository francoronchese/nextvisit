import { useAdminLogin } from "../hooks/useAdminLogin";
import { LoginForm } from "../components/LoginForm";
import { SecretaryDashboard } from "../components/SecretaryDashboard";
import { DoctorDashboard } from "../components/DoctorDashboard";
import { AdminDashboard } from "../components/AdminDashboard";

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
          <SecretaryDashboard user={user} onLogout={logout} />
        ) : user.role === "doctor" ? (
          <DoctorDashboard user={user} onLogout={logout} />
        ) : (
          <AdminDashboard user={user} onLogout={logout} />
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