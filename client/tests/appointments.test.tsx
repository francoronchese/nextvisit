import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppointmentManagementPage } from "../src/features/appointments";

const TOKEN = "a".repeat(64);

const cardio = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Cardiology" };
const consultaCardio = {
  id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
  specialtyId: cardio.id,
  name: "Cardiology consultation",
  durationMinutes: 30,
};
const maria = {
  id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16",
  specialtyId: cardio.id,
  firstName: "María",
  lastName: "González",
};
const patient = {
  id: "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a17",
  dni: "30111222",
  firstName: "Ana",
  lastName: "Pérez",
  healthInsuranceId: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a1a",
  phone: "555-0101",
  email: "ana@example.com",
};

const detail = {
  appointment: {
    id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18",
    patientId: patient.id,
    doctorId: maria.id,
    appointmentTypeId: consultaCardio.id,
    startsAt: "2026-09-07T12:00:00.000Z",
    durationMinutes: 30,
    bookingChannel: "web",
    status: "scheduled",
    attendance: "pending",
    copayAmount: 5000,
    copayPaid: false,
    createdAt: "2026-09-07T08:00:00.000Z",
  },
  patient,
  doctor: maria,
  specialty: cardio,
  appointmentType: consultaCardio,
};

const slot09 = { date: "2026-09-08", startTime: "09:00", endTime: "09:30", available: true };
const slot0930 = { date: "2026-09-08", startTime: "09:30", endTime: "10:00", available: true };

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

let cancelHandler: () => Response;
let rescheduleHandler: (body: unknown) => Response;

function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  if (url === `/api/appointments/${TOKEN}`) return Promise.resolve(jsonResponse(detail));
  if (url.includes(`/api/doctors/${maria.id}/slots`)) {
    return Promise.resolve(jsonResponse([slot09, slot0930]));
  }
  if (url === `/api/appointments/${TOKEN}/cancel` && init?.method === "POST") {
    return Promise.resolve(cancelHandler());
  }
  if (url === `/api/appointments/${TOKEN}/reschedule` && init?.method === "POST") {
    return Promise.resolve(rescheduleHandler(JSON.parse(String(init.body))));
  }
  return Promise.resolve(jsonResponse({ error: "not found" }, 404));
}

const fetchMock = vi.fn(defaultFetch);

async function renderAtAppointment(token: string) {
  window.history.pushState({}, "", `/appointments/${token}`);
  render(<AppointmentManagementPage />);
}

beforeEach(() => {
  cancelHandler = () => jsonResponse({ ...detail.appointment, status: "cancelled" });
  rescheduleHandler = () =>
    jsonResponse({ ...detail.appointment, startsAt: "2026-09-08T12:30:00.000Z" });
  fetchMock.mockClear();
  fetchMock.mockImplementation(defaultFetch);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppointmentManagementPage", () => {
  it("loads and shows the appointment with its context", async () => {
    await renderAtAppointment(TOKEN);

    expect(
      await screen.findByRole("heading", { name: "Your appointment" })
    ).toBeInTheDocument();
    expect(screen.getByText(/María González, Cardiology/)).toBeInTheDocument();
    expect(screen.getByText(/lunes, 7 de septiembre de 2026 at 09:00/)).toBeInTheDocument();
    expect(
      screen.getByText(/You will receive a reminder 24h before your appointment/)
    ).toBeInTheDocument();
  });

  it("cancels the appointment and shows the cancellation confirmation", async () => {
    const user = userEvent.setup();
    await renderAtAppointment(TOKEN);

    await user.click(await screen.findByRole("button", { name: "Cancel appointment" }));

    expect(
      await screen.findByRole("heading", { name: "Your appointment has been cancelled" })
    ).toBeInTheDocument();
    const cancelCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/cancel") && init?.method === "POST"
    );
    expect(cancelCall).toBeDefined();
  });

  it("reschedules to a picked slot and shows the reschedule confirmation", async () => {
    const user = userEvent.setup();
    await renderAtAppointment(TOKEN);

    await user.click(await screen.findByRole("button", { name: /09:30/ }));
    await user.click(screen.getByRole("button", { name: "Reschedule to 09:30" }));

    expect(
      await screen.findByRole("heading", { name: "Your appointment has been rescheduled" })
    ).toBeInTheDocument();
    const rescheduleCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/reschedule") && init?.method === "POST"
    );
    expect(rescheduleCall).toBeDefined();
    expect(JSON.parse(String(rescheduleCall![1]!.body))).toEqual({
      date: "2026-09-08",
      startTime: "09:30",
    });
  });

  it("shows the error when the cancellation window has closed", async () => {
    cancelHandler = () => jsonResponse({ error: "the cancellation window has closed" }, 409);
    const user = userEvent.setup();
    await renderAtAppointment(TOKEN);

    await user.click(await screen.findByRole("button", { name: "Cancel appointment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /the cancellation window has closed/
    );
    expect(screen.getByRole("heading", { name: "Your appointment" })).toBeInTheDocument();
  });

  it("shows a helpful message for a malformed link", async () => {
    await renderAtAppointment("broken-token");

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(/This link looks incomplete/);
  });
});