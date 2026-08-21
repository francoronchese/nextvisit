import type { User } from "@nextvisit/shared";
import { DashboardShell } from "../../../components/DashboardShell";
import { HealthInsuranceManager } from "./HealthInsuranceManager";
import { UserManager } from "./UserManager";

type AdminDashboardProps = {
  user: User;
  onLogout: () => void;
};

export function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  return (
    <DashboardShell title="Admin panel" user={user} onLogout={onLogout}>
      <div className="space-y-10">
        <HealthInsuranceManager />
        <UserManager />
      </div>
    </DashboardShell>
  );
}