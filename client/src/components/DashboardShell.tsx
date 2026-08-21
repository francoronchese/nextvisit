import type { ReactNode } from "react";
import type { User } from "@nextvisit/shared";

type DashboardShellProps = {
  title: string;
  user: User;
  onLogout: () => void;
  children: ReactNode;
};

export function DashboardShell({ title, user, onLogout, children }: DashboardShellProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <button
          type="button"
          onClick={onLogout}
          className="cursor-pointer rounded-2xl border-2 border-gray-200 px-4 py-2 font-medium text-gray-900 hover:border-blue-400"
        >
          Sign out
        </button>
      </div>
      <p className="mb-6 text-lg text-gray-600">Signed in as {user.email} ({user.role}).</p>
      {children}
    </div>
  );
}