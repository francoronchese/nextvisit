import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLoginPage } from "../src/features/admin";
import { clearStaffSessionToken } from "../src/services/apiClient";

const doctorUser = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  email: "maria.gonzalez@nextvisit.ar",
  role: "doctor",
  doctorId: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16",
  createdAt: "2026-08-15T00:00:00.000Z",
};

const upcoming = {
  appointment: {
    id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18",
    startsAt: "2026-09-07T12:00:00.000Z",
    durationMinutes: 30,
    status: "scheduled",
  },
  patient: { firstName: "Ana", lastName: "Pérez", dni: "30111222" },
  appointmentType: { name: "Cardiology consultation" },
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  if (url === "/api/admin/login" && init?.method === "POST") {
    return Promise.resolve(jsonResponse({ token: "signed-token", user: doctorUser }));
  }
  if (url === "/api/admin/appointments") {
    return Promise.resolve(jsonResponse([upcoming]));
  }
  return Promise.resolve(jsonResponse({ error: "not found" }, 404));
}

const fetchMock = vi.fn(defaultFetch);

async function signInAsDoctor(user: ReturnType<typeof userEvent.setup>) {
  render(<AdminLoginPage />);
  await user.type(screen.getByLabelText("Email"), doctorUser.email);
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.click(screen.getByRole("button", { name: /Sign in/ }));
  await screen.findByRole("heading", { name: "Doctor panel" });
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

describe("doctor view appointments", () => {
  it("shows the doctor's upcoming appointments read-only with patient and type details", async () => {
    const user = userEvent.setup();
    await signInAsDoctor(user);

    expect(await screen.findByText(/Ana Pérez/)).toBeInTheDocument();
    expect(screen.getByText(/DNI 30111222/)).toBeInTheDocument();
    expect(screen.getByText(/Cardiology consultation/)).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();

    // The list is read-only: no cancel or reschedule actions next to a row.
    expect(screen.queryByRole("button", { name: /Cancel|Reschedule/ })).not.toBeInTheDocument();

    const listCall = fetchMock.mock.calls.find(
      ([url]) => String(url) === "/api/admin/appointments"
    );
    expect(listCall).toBeDefined();
    const headers = new Headers(listCall![1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer signed-token");
  });

  it("shows an empty state when the doctor has no upcoming appointments", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/login" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ token: "signed-token", user: doctorUser }));
      }
      if (url === "/api/admin/appointments") {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({ error: "not found" }, 404));
    });

    const user = userEvent.setup();
    await signInAsDoctor(user);

    expect(await screen.findByText("You have no upcoming appointments.")).toBeInTheDocument();
  });
});