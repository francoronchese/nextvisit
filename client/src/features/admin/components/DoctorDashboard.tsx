import type { User } from "@nextvisit/shared";
import { DashboardShell } from "../../../components/DashboardShell";
import { DoctorAppointments } from "./DoctorAppointments";

type DoctorDashboardProps = {
  user: User;
  onLogout: () => void;
};

export function DoctorDashboard({ user, onLogout }: DoctorDashboardProps) {
  return (
    <DashboardShell title="Doctor panel" user={user} onLogout={onLogout}>
      <DoctorAppointments />
    </DashboardShell>
  );
}