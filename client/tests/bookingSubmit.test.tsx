import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingFlow } from "../src/features/booking";

const cardio = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Cardiology" };
const consultaCardio = {
  id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
  specialtyId: cardio.id,
  name: "Cardiology consultation",
  durationMinutes: 30,
};
const insurance = { id: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a1a", name: "IOMA", copayAmount: 5000 };
const maria = {
  id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16",
  specialtyId: cardio.id,
  firstName: "María",
  lastName: "González",
};

const slot09 = { date: "2026-09-07", startTime: "09:00", endTime: "09:30", available: true };
const slot0930 = { date: "2026-09-07", startTime: "09:30", endTime: "10:00", available: true };

const bookingResult = {
  patient: {
    id: "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a17",
    dni: "30111222",
    firstName: "Ana",
    lastName: "Pérez",
    healthInsuranceId: insurance.id,
    phone: "555-0101",
    email: "ana@example.com",
  },
  appointment: {
    id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18",
    patientId: "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a17",
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
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

let bookingHandler: (body: unknown) => Response;

function defaultFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  if (url === "/api/health-insurances") return Promise.resolve(jsonResponse([insurance]));
  if (url === "/api/specialties") return Promise.resolve(jsonResponse([cardio]));
  if (url === `/api/specialties/${cardio.id}/types`) return Promise.resolve(jsonResponse([consultaCardio]));
  if (url === `/api/types/${consultaCardio.id}/doctors`) return Promise.resolve(jsonResponse([maria]));
  if (url.includes(`/api/doctors/${maria.id}/slots`)) {
    return Promise.resolve(jsonResponse([slot09, slot0930]));
  }
  if (url === "/api/bookings" && init?.method === "POST") {
    return Promise.resolve(bookingHandler(JSON.parse(String(init.body))));
  }
  return Promise.resolve(jsonResponse({ error: "not found" }, 404));
}

const fetchMock = vi.fn(defaultFetch);

async function fillPatientForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("DNI"), "30111222");
  await user.type(screen.getByLabelText("First name"), "Ana");
  await user.type(screen.getByLabelText("Last name"), "Pérez");
  await user.selectOptions(await screen.findByLabelText("Health insurance"), insurance.id);
  await user.type(screen.getByLabelText("Phone"), "555-0101");
  await user.type(screen.getByLabelText("Email"), "ana@example.com");
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

async function reachSlotStep(user: ReturnType<typeof userEvent.setup>) {
  await fillPatientForm(user);
  await user.click(await screen.findByRole("button", { name: "Cardiology" }));
  await user.click(await screen.findByRole("button", { name: /Cardiology consultation/ }));
  await user.click(await screen.findByRole("button", { name: "María González" }));
  await user.click(await screen.findByRole("button", { name: /09:00/ }));
}

beforeEach(() => {
  bookingHandler = () => jsonResponse(bookingResult);
  fetchMock.mockClear();
  fetchMock.mockImplementation(defaultFetch);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BookingFlow — booking submission", () => {
  it("posts the patient data with the chosen slot and shows the confirmation screen", async () => {
    const user = userEvent.setup();
    render(<BookingFlow />);

    await reachSlotStep(user);
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    expect(
      await screen.findByRole("heading", { name: "Your appointment is confirmed" })
    ).toBeInTheDocument();
    expect(screen.getByText(/María González, Cardiology/)).toBeInTheDocument();
    expect(screen.getByText(/lunes, 7 de septiembre de 2026 at 09:00/)).toBeInTheDocument();
    expect(screen.getByText(/A confirmation email was sent to ana@example.com/)).toBeInTheDocument();
    expect(screen.queryByText(/reminder 24h/)).not.toBeInTheDocument();

    const bookingCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/api/bookings") && init?.method === "POST"
    );
    expect(bookingCall).toBeDefined();
    const body = JSON.parse(String(bookingCall![1]!.body));
    expect(body).toMatchObject({
      dni: "30111222",
      firstName: "Ana",
      email: "ana@example.com",
      doctorId: maria.id,
      typeId: consultaCardio.id,
      date: "2026-09-07",
      startTime: "09:00",
    });
  });

  it("shows an error and refreshes the grid when the slot was just taken", async () => {
    bookingHandler = () => jsonResponse({ error: "that slot is no longer available" }, 409);
    const user = userEvent.setup();
    render(<BookingFlow />);

    await reachSlotStep(user);
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(/that slot is no longer available/);
    expect(screen.queryByText(/You chose/)).not.toBeInTheDocument();

    const slotsCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes(`/api/doctors/${maria.id}/slots`)
    );
    expect(slotsCalls.length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole("heading", { name: "Pick a time for your appointment" })
    ).toBeInTheDocument();
  });

  it("shows the cap message when the patient already has 3 future appointments", async () => {
    bookingHandler = () => jsonResponse({ error: "you already have 3 future appointments" }, 422);
    const user = userEvent.setup();
    render(<BookingFlow />);

    await reachSlotStep(user);
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /you already have 3 future appointments/
    );
    expect(
      screen.getByRole("heading", { name: "Pick a time for your appointment" })
    ).toBeInTheDocument();
  });
});