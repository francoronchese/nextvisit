import { AdminLoginPage } from "./features/admin";
import { BookingFlow } from "./features/booking";

export default function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminLoginPage />;
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