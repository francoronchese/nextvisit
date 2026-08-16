import { AdminLoginPage } from "./features/admin";
import { AppointmentManagementPage } from "./features/appointments";
import { BookingFlow } from "./features/booking";

export default function App() {
  const path = window.location.pathname;
  if (path.startsWith("/admin")) {
    return <AdminLoginPage />;
  }
  if (path.startsWith("/appointments/")) {
    return <AppointmentManagementPage />;
  }
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">Next Visit</h1>
          <p className="text-gray-600">Book your medical appointment online.</p>
        </div>
      </header>
      <BookingFlow />
    </main>
  );
}