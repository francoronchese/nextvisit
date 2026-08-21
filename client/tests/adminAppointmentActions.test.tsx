import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLoginPage } from "../src/features/admin";
import { clearStaffSessionToken } from "../src/services/apiClient";

const secretaryUser = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  email: "secretary@nextvisit.ar",
  role: "secretary",
  createdAt: "2026-08-15T00:00:00.000Z",
};

const insurance = { id: "ins-ioma", name: "IOMA", copayAmount: 5000 };
const patient = {
  id: "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a17",
  dni: "30111222",
  firstName: "Ana",
  lastName: "Pérez",
  healthInsuranceId: insurance.id,
  phone: "555-0101",
  email: "ana@example.com",
};
const doctor = {
  id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16",
  specialtyId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  firstName: "María",
  lastName: "González",
};
const specialty = { id: doctor.specialtyId, name: "Cardiology" };
const appointmentType = {
  id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
  specialtyId: doctor.specialtyId,
  name: "Cardiology consultation",
  durationMinutes: 30,
};

const APPOINTMENT_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18";

const scheduledRecord = {
  appointment: {
    id: APPOINTMENT_ID,
    patientId: patient.id,
    doctorId: doctor.id,
    appointmentTypeId: appointmentType.id,
    startsAt: "2026-09-07T12:00:00.000Z",
    durationMinutes: 30,
    bookingChannel: "front_desk",
    status: "scheduled",
    attendance: "pending",
    copayAmount: 5000,
    copayPaid: false,
    createdAt: "2026-09-07T08:00:00.000Z",
  },
  patient,
  doctor,
  specialty,
  appointmentType,
  insurance,
};

const slots = [
  { date: "2026-09-08", startTime: "09:00", available: true },
  { date: "2026-09-08", startTime: "09:30", available: true },
  { date: "2026-09-08", startTime: "10:00", available: true },
];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  if (url === "/api/admin/login" && init?.method === "POST") {
    return Promise.resolve(jsonResponse({ token: "signed-token", user: secretaryUser }));
  }
  if (url.startsWith("/api/admin/appointments?date=")) {
    return Promise.resolve(jsonResponse([scheduledRecord]));
  }
  if (url.startsWith("/api/doctors/") && url.includes("/slots")) {
    return Promise.resolve(jsonResponse(slots));
  }
  if (url === `/api/admin/appointments/${APPOINTMENT_ID}/cancel` && init?.method === "POST") {
    return Promise.resolve(jsonResponse(scheduledRecord.appointment));
  }
  if (url === `/api/admin/appointments/${APPOINTMENT_ID}/reschedule` && init?.method === "POST") {
    return Promise.resolve(jsonResponse(scheduledRecord.appointment));
  }
  return Promise.resolve(jsonResponse({ error: "not found" }, 404));
}

const fetchMock = vi.fn(defaultFetch);

async function signInAndOpenAttendance(user: ReturnType<typeof userEvent.setup>) {
  render(<AdminLoginPage />);
  await user.type(screen.getByLabelText("Email"), secretaryUser.email);
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.click(screen.getByRole("button", { name: /Sign in/ }));
  await screen.findByRole("heading", { name: "Secretary panel" });
  await user.click(screen.getByRole("button", { name: "Attendance" }));
}

beforeEach(() => {
  clearStaffSessionToken();
  fetchMock.mockClear();
  fetchMock.mockImplementation(defaultFetch);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("secretary cancel/reschedule", () => {
  it("cancels an appointment after confirmation and refreshes the day", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    await signInAndOpenAttendance(user);

    const row = (await screen.findByRole("button", { name: /Ana Pérez/ })).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Cancel" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("Cancel the appointment for Ana Pérez")
    );
    expect(await screen.findByText("Appointment cancelled.")).toBeInTheDocument();

    const cancelCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url) === `/api/admin/appointments/${APPOINTMENT_ID}/cancel` &&
        init?.method === "POST"
    );
    expect(cancelCall).toBeDefined();
    const headers = new Headers(cancelCall![1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer signed-token");
  });

  it("keeps the appointment when the secretary declines the cancel confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    await signInAndOpenAttendance(user);

    const row = (await screen.findByRole("button", { name: /Ana Pérez/ })).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Cancel" }));

    const cancelCalls = fetchMock.mock.calls.filter(
      ([url, init]) =>
        String(url) === `/api/admin/appointments/${APPOINTMENT_ID}/cancel` &&
        init?.method === "POST"
    );
    expect(cancelCalls).toHaveLength(0);
    expect(screen.queryByText("Appointment cancelled.")).not.toBeInTheDocument();
  });

  it("reschedules to a new slot and refreshes the day", async () => {
    const user = userEvent.setup();
    await signInAndOpenAttendance(user);

    const row = (await screen.findByRole("button", { name: /Ana Pérez/ })).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Reschedule" }));

    await screen.findByRole("button", { name: "10:00" });
    await user.click(screen.getByRole("button", { name: "10:00" }));
    await user.click(screen.getByRole("button", { name: /Reschedule to 10:00/ }));

    expect(
      await screen.findByText("Appointment rescheduled to 2026-09-08 at 10:00.")
    ).toBeInTheDocument();

    const rescheduleCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url) === `/api/admin/appointments/${APPOINTMENT_ID}/reschedule` &&
        init?.method === "POST"
    );
    expect(rescheduleCall).toBeDefined();
    expect(JSON.parse(String(rescheduleCall![1]?.body))).toEqual({
      date: "2026-09-08",
      startTime: "10:00",
    });
  });
});
