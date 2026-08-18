import { useState } from "react";
import type { User } from "@nextvisit/shared";
import { AvailabilityManager } from "./AvailabilityManager";
import { SecretaryBookingForm } from "./SecretaryBookingForm";

type SecretaryDashboardProps = {
  user: User;
  onLogout: () => void;
};

const TABS = ["availability", "booking"] as const;
type SecretaryTab = (typeof TABS)[number];

export function SecretaryDashboard({ user, onLogout }: SecretaryDashboardProps) {
  const [tab, setTab] = useState<SecretaryTab>("availability");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Secretary panel</h2>
        <button
          type="button"
          onClick={onLogout}
          className="cursor-pointer rounded-2xl border-2 border-gray-200 px-4 py-2 font-medium text-gray-900 hover:border-blue-400"
        >
          Sign out
        </button>
      </div>
      <p className="mb-4 text-lg text-gray-600">Signed in as {user.email} ({user.role}).</p>

      <nav aria-label="Secretary sections" className="mb-6 flex gap-2">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`cursor-pointer rounded-2xl px-4 py-2 text-lg font-medium transition-colors ${
              tab === value
                ? "bg-blue-700 text-white"
                : "border-2 border-gray-200 text-gray-900 hover:border-blue-400"
            }`}
          >
            {value === "availability" ? "Availability" : "Book an appointment"}
          </button>
        ))}
      </nav>

      {tab === "availability" ? <AvailabilityManager /> : <SecretaryBookingForm />}
    </div>
  );
}
