import { useState, type ReactElement } from "react";
import type { User } from "@nextvisit/shared";
import { DashboardShell } from "../../../components/DashboardShell";
import { AttendanceManager } from "./AttendanceManager";
import { AvailabilityManager } from "./AvailabilityManager";
import { SecretaryBookingForm } from "./SecretaryBookingForm";

type SecretaryDashboardProps = {
  user: User;
  onLogout: () => void;
};

const TABS = ["availability", "booking", "attendance"] as const;
type SecretaryTab = (typeof TABS)[number];

const TAB_LABELS: Record<SecretaryTab, string> = {
  availability: "Availability",
  booking: "Book an appointment",
  attendance: "Attendance",
};

const TAB_CONTENT: Record<SecretaryTab, () => ReactElement> = {
  availability: () => <AvailabilityManager />,
  booking: () => <SecretaryBookingForm />,
  attendance: () => <AttendanceManager />,
};

export function SecretaryDashboard({ user, onLogout }: SecretaryDashboardProps) {
  const [tab, setTab] = useState<SecretaryTab>("availability");

  return (
    <DashboardShell title="Secretary panel" user={user} onLogout={onLogout}>
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
            {TAB_LABELS[value]}
          </button>
        ))}
      </nav>

      {TAB_CONTENT[tab]()}
    </DashboardShell>
  );
}