import { useState } from "react";
import type { FormEvent } from "react";
import type { LoginCredentials } from "../admin.types";
import { useAdminLogin } from "../hooks/useAdminLogin";

export function LoginForm() {
  const { user, loading, error, login, logout } = useAdminLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const credentials: LoginCredentials = { email, password };
    void login(credentials);
  };

  if (user) {
    return (
      <div>
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
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="admin-email" className="mb-1 block text-lg text-gray-700">
          Email
        </label>
        <input
          id="admin-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="admin-password" className="mb-1 block text-lg text-gray-700">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-2xl border-2 border-gray-200 p-3 text-lg text-gray-900 focus:border-blue-400 focus:outline-none"
        />
      </div>
      {error && (
        <div role="alert" className="text-lg text-red-700">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}