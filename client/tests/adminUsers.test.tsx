import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLoginPage } from "../src/features/admin";
import { clearStaffSessionToken } from "../src/services/apiClient";

const adminUser = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  email: "admin@nextvisit.ar",
  role: "admin",
  createdAt: "2026-08-15T00:00:00.000Z",
};

const secretary = {
  id: "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a17",
  email: "secretary@nextvisit.ar",
  role: "secretary",
  createdAt: "2026-08-15T00:00:00.000Z",
};

const doctorRow = {
  id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16",
  specialtyId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  firstName: "María",
  lastName: "González",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchInput = RequestInfo | URL;
type FetchInit = RequestInit | undefined;

function defaultFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  if (url === "/api/admin/login" && init?.method === "POST") {
    return Promise.resolve(jsonResponse({ token: "signed-token", user: adminUser }));
  }
  if (url === "/api/admin/health-insurances") {
    return Promise.resolve(jsonResponse([]));
  }
  if (url === "/api/admin/users" && init?.method === "POST") {
    const body = JSON.parse(String(init?.body)) as { email: string; role: string };
    return Promise.resolve(
      jsonResponse({ ...secretary, id: "b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a19", email: body.email, role: body.role }, 201)
    );
  }
  if (url === "/api/admin/users") {
    return Promise.resolve(jsonResponse([secretary]));
  }
  if (url === "/api/admin/doctors") {
    return Promise.resolve(jsonResponse([doctorRow]));
  }
  return Promise.resolve(jsonResponse({ error: "not found" }, 404));
}

const fetchMock = vi.fn(defaultFetch);

async function signInAsAdmin(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  render(<AdminLoginPage />);
  await user.type(screen.getByLabelText("Email"), adminUser.email);
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.click(screen.getByRole("button", { name: /Sign in/ }));
  await screen.findByRole("heading", { name: "Admin panel" });
}

beforeEach(() => {
  clearStaffSessionToken();
  fetchMock.mockClear();
  fetchMock.mockImplementation(defaultFetch);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin staff credentials", () => {
  it("lists all staff users with their roles", async () => {
    const user = userEvent.setup();
    await signInAsAdmin(user);

    const entry = screen.getByText("secretary@nextvisit.ar").closest("li");
    expect(within(entry!).getByText("Secretary")).toBeInTheDocument();
  });

  it("creates a secretary user and refreshes the staff list", async () => {
    const staff = [{ ...secretary }];
    fetchMock.mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/login" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ token: "signed-token", user: adminUser }));
      }
      if (url === "/api/admin/health-insurances") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === "/api/admin/users" && init?.method === "POST") {
        const body = JSON.parse(String(init?.body)) as { email: string; role: string };
        const created = { ...secretary, id: "b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a19", email: body.email, role: body.role };
        staff.push(created);
        return Promise.resolve(jsonResponse(created, 201));
      }
      if (url === "/api/admin/users") {
        return Promise.resolve(jsonResponse(staff));
      }
      if (url === "/api/admin/doctors") {
        return Promise.resolve(jsonResponse([doctorRow]));
      }
      return Promise.resolve(jsonResponse({ error: "not found" }, 404));
    });

    const user = userEvent.setup();
    await signInAsAdmin(user);

    await user.type(screen.getByLabelText("Email"), "nurse@nextvisit.ar");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /Create credentials/ }));

    expect(await screen.findByText("nurse@nextvisit.ar")).toBeInTheDocument();
    // The form cleared after a successful create.
    expect(screen.getByLabelText("Email")).toHaveValue("");

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === "/api/admin/users" && init?.method === "POST"
    );
    expect(postCall).toBeDefined();
    const headers = new Headers(postCall![1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer signed-token");
    expect(JSON.parse(String(postCall![1]?.body))).toEqual({
      email: "nurse@nextvisit.ar",
      password: "secret123",
      role: "secretary",
    });
  });

  it("creates a doctor user only after linking it to a doctor", async () => {
    const staff = [{ ...secretary }];
    fetchMock.mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/login" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ token: "signed-token", user: adminUser }));
      }
      if (url === "/api/admin/health-insurances") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === "/api/admin/users" && init?.method === "POST") {
        const body = JSON.parse(String(init?.body)) as { email: string; role: string; doctorId: string };
        const created = {
          ...secretary,
          id: "b3eebc99-9c0b-4ef8-bb6d-6bb9bd380a1b",
          email: body.email,
          role: body.role,
          doctorId: body.doctorId,
        };
        staff.push(created);
        return Promise.resolve(jsonResponse(created, 201));
      }
      if (url === "/api/admin/users") {
        return Promise.resolve(jsonResponse(staff));
      }
      if (url === "/api/admin/doctors") {
        return Promise.resolve(jsonResponse([doctorRow]));
      }
      return Promise.resolve(jsonResponse({ error: "not found" }, 404));
    });

    const user = userEvent.setup();
    await signInAsAdmin(user);

    await user.type(screen.getByLabelText("Email"), "doctor@nextvisit.ar");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.selectOptions(screen.getByLabelText("Role"), "doctor");

    const doctorSelect = await screen.findByLabelText("Doctor");
    await user.selectOptions(doctorSelect, doctorRow.id);
    await user.click(screen.getByRole("button", { name: /Create credentials/ }));

    expect(await screen.findByText("doctor@nextvisit.ar")).toBeInTheDocument();
    const entry = screen.getByText("doctor@nextvisit.ar").closest("li");
    expect(within(entry!).getByText(/María González/)).toBeInTheDocument();

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === "/api/admin/users" && init?.method === "POST"
    );
    expect(JSON.parse(String(postCall![1]?.body))).toEqual({
      email: "doctor@nextvisit.ar",
      password: "secret123",
      role: "doctor",
      doctorId: doctorRow.id,
    });
  });

  it("shows the server error when the email is already taken", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/login" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ token: "signed-token", user: adminUser }));
      }
      if (url === "/api/admin/health-insurances") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === "/api/admin/users" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ error: "a user with that email already exists" }, 409));
      }
      if (url === "/api/admin/users") {
        return Promise.resolve(jsonResponse([secretary]));
      }
      if (url === "/api/admin/doctors") {
        return Promise.resolve(jsonResponse([doctorRow]));
      }
      return Promise.resolve(jsonResponse({ error: "not found" }, 404));
    });

    const user = userEvent.setup();
    await signInAsAdmin(user);

    await user.type(screen.getByLabelText("Email"), secretary.email);
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /Create credentials/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "a user with that email already exists"
    );
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveValue(secretary.email));
  });
});