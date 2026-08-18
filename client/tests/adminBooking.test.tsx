import { render, screen } from "@testing-library/react";
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
    bookingChannel: "front_desk",
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
  if (url === "/api/admin/login" && init?.method === "POST") {
    return Promise.resolve(jsonResponse({ token: "signed-token", user: secretaryUser }));
  }
  if (url === "/api/admin/doctors") return Promise.resolve(jsonResponse([maria]));
  if (url.startsWith("/api/admin/availability?doctorId=")) return Promise.resolve(jsonResponse([]));
  if (url.startsWith("/api/admin/availability-blocks?doctorId=")) return Promise.resolve(jsonResponse([]));
  if (url === "/api/health-insurances") return Promise.resolve(jsonResponse([insurance]));
  if (url === "/api/specialties") return Promise.resolve(jsonResponse([cardio]));
  if (url === `/api/specialties/${cardio.id}/types`) return Promise.resolve(jsonResponse([consultaCardio]));
  if (url === `/api/types/${consultaCardio.id}/doctors`) return Promise.resolve(jsonResponse([maria]));
  if (url.includes(`/api/doctors/${maria.id}/slots`)) {
    return Promise.resolve(jsonResponse([slot09, slot0930]));
  }
  if (url === "/api/admin/appointments" && init?.method === "POST") {
    return Promise.resolve(bookingHandler(JSON.parse(String(init.body))));
  }
  return Promise.resolve(jsonResponse({ error: "not found" }, 404));
}

const fetchMock = vi.fn(defaultFetch);

async function signInAndOpenBooking(user: ReturnType<typeof userEvent.setup>) {
  render(<AdminLoginPage />);
  await user.type(screen.getByLabelText("Email"), secretaryUser.email);
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.click(screen.getByRole("button", { name: /Sign in/ }));
  await screen.findByRole("heading", { name: "Secretary panel" });
  await user.click(screen.getByRole("button", { name: "Book an appointment" }));
  await screen.findByRole("heading", { name: "Which specialty?" });
}

async function reachPatientStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Cardiology" }));
  await user.click(await screen.findByRole("button", { name: /Cardiology consultation/ }));
  await user.click(await screen.findByRole("button", { name: "María González" }));
  await user.click(await screen.findByRole("button", { name: /09:00/ }));
  await screen.findByRole("heading", { name: "Patient details" });
}

beforeEach(() => {
  bookingHandler = (rawBody) => {
    const body = rawBody as { email?: string; bookingChannel?: "front_desk" | "phone" };
    return jsonResponse({
      patient: { ...bookingResult.patient, email: body.email ? body.email : null },
      appointment: {
        ...bookingResult.appointment,
        bookingChannel: body.bookingChannel ?? "front_desk",
      },
    });
  };
  clearStaffSessionToken();
  fetchMock.mockClear();
  fetchMock.mockImplementation(defaultFetch);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("secretary booking on behalf", () => {
  it("books through the front desk, posting patient data and the channel to /api/admin/appointments", async () => {
    const user = userEvent.setup();
    await signInAndOpenBooking(user);
    await reachPatientStep(user);

    await user.type(screen.getByLabelText("DNI"), "30111222");
    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "Pérez");
    await user.selectOptions(screen.getByLabelText("Health insurance"), insurance.id);
    await user.type(screen.getByLabelText("Phone number"), "555-0101");
    await user.type(screen.getByLabelText(/^Email/), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Book appointment" }));

    expect(await screen.findByRole("heading", { name: "Appointment booked" })).toBeInTheDocument();
    expect(screen.getByText(/A confirmation email was sent to ana@example.com/)).toBeInTheDocument();

    const bookingCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === "/api/admin/appointments" && init?.method === "POST"
    );
    expect(bookingCall).toBeDefined();
    const headers = new Headers(bookingCall![1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer signed-token");
    expect(JSON.parse(String(bookingCall![1]?.body))).toMatchObject({
      dni: "30111222",
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      doctorId: maria.id,
      typeId: consultaCardio.id,
      date: "2026-09-07",
      startTime: "09:00",
      bookingChannel: "front_desk",
    });
  });

  it("books by phone without an email and confirms that no email was sent", async () => {
    const user = userEvent.setup();
    await signInAndOpenBooking(user);
    await reachPatientStep(user);

    await user.type(screen.getByLabelText("DNI"), "30111222");
    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "Pérez");
    await user.selectOptions(screen.getByLabelText("Health insurance"), insurance.id);
    await user.type(screen.getByLabelText("Phone number"), "555-0101");
    await user.click(screen.getByRole("radio", { name: "Phone" }));
    await user.click(screen.getByRole("button", { name: "Book appointment" }));

    expect(await screen.findByRole("heading", { name: "Appointment booked" })).toBeInTheDocument();
    expect(
      screen.getByText(/No confirmation email was sent because the patient didn't provide one/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Booking channel: Phone/)).toBeInTheDocument();

    const bookingCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === "/api/admin/appointments" && init?.method === "POST"
    );
    const body = JSON.parse(String(bookingCall![1]?.body));
    expect(body.bookingChannel).toBe("phone");
    expect(body.email).toBeUndefined();
  });

  it("shows the cap message when the patient already has 3 future appointments", async () => {
    bookingHandler = () => jsonResponse({ error: "you already have 3 future appointments" }, 422);
    const user = userEvent.setup();
    await signInAndOpenBooking(user);
    await reachPatientStep(user);

    await user.type(screen.getByLabelText("DNI"), "30111222");
    await user.type(screen.getByLabelText("First name"), "Ana");
    await user.type(screen.getByLabelText("Last name"), "Pérez");
    await user.selectOptions(screen.getByLabelText("Health insurance"), insurance.id);
    await user.type(screen.getByLabelText("Phone number"), "555-0101");
    await user.click(screen.getByRole("button", { name: "Book appointment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /you already have 3 future appointments/
    );
    expect(screen.getByRole("heading", { name: "Patient details" })).toBeInTheDocument();
  });
});
