import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLoginPage } from "../src/features/admin";
import {
  apiGet,
  clearStaffSessionToken,
  getStaffSessionToken,
  setStaffSessionToken,
} from "../src/services/apiClient";

const adminUser = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  email: "admin@nextvisit.ar",
  role: "admin",
  createdAt: "2026-08-15T00:00:00.000Z",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

const fetchMock = vi.fn();

beforeEach(() => {
  clearStaffSessionToken();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin login", () => {
  it("signs in with valid credentials, stores the token, and shows the user", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/login") {
        const body = JSON.parse(String(init?.body));
        expect(init?.method).toBe("POST");
        expect(body).toEqual({ email: "admin@nextvisit.ar", password: "secret123" });
        return jsonResponse({ token: "signed-token", user: adminUser });
      }
      if (url === "/api/admin/users" || url === "/api/admin/health-insurances") {
        return jsonResponse([]);
      }
      return jsonResponse({ error: "not found" }, 404);
    });

    const user = userEvent.setup();
    render(<AdminLoginPage />);

    await user.type(screen.getByLabelText("Email"), "admin@nextvisit.ar");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    expect(await screen.findByText(/Signed in as admin@nextvisit.ar/)).toBeInTheDocument();
    expect(getStaffSessionToken()).toBe("signed-token");
  });

  it("shows the error message when credentials are invalid", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/login") {
        return jsonResponse({ error: "invalid credentials" }, 401);
      }
      return jsonResponse({ error: "not found" }, 404);
    });

    const user = userEvent.setup();
    render(<AdminLoginPage />);

    await user.type(screen.getByLabelText("Email"), "admin@nextvisit.ar");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid credentials");
    expect(getStaffSessionToken()).toBeNull();
  });
});

describe("apiClient staff token injection", () => {
  it("injects the staff session token only on admin requests", async () => {
    setStaffSessionToken("signed-token");
    fetchMock.mockResolvedValue(jsonResponse({ id: adminUser.id }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: adminUser.id }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: adminUser.id }));

    await apiGet("/api/admin/dashboard");
    await apiGet("/api/specialties");

    const adminHeaders = new Headers(fetchMock.mock.calls[0]![1]?.headers);
    const publicHeaders = new Headers(fetchMock.mock.calls[1]![1]?.headers);
    expect(adminHeaders.get("Authorization")).toBe("Bearer signed-token");
    expect(publicHeaders.get("Authorization")).toBeNull();
  });

  it("does not inject a header when no token is stored", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: adminUser.id }));

    await apiGet("/api/admin/dashboard");

    const headers = new Headers(fetchMock.mock.calls[0]![1]?.headers);
    expect(headers.get("Authorization")).toBeNull();
  });
});