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

const NO_SHOW_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18";

function detailRecord(overrides: {
  attendance: "pending" | "no_show";
  status: "scheduled" | "ended";
  copayPaid?: boolean;
}) {
  return {
    appointment: {
      id: NO_SHOW_ID,
      patientId: patient.id,
      doctorId: doctor.id,
      appointmentTypeId: appointmentType.id,
      startsAt: "2026-09-07T12:00:00.000Z",
      durationMinutes: 30,
      bookingChannel: "front_desk",
      status: overrides.status,
      attendance: overrides.attendance,
      copayAmount: 5000,
      copayPaid: overrides.copayPaid ?? false,
      createdAt: "2026-09-07T08:00:00.000Z",
    },
    patient,
    doctor,
    specialty,
    appointmentType,
    insurance,
  };
}

const dayList = [detailRecord({ attendance: "no_show", status: "ended" })];

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
    return Promise.resolve(jsonResponse(dayList));
  }
  if (url.startsWith(`/api/admin/appointments/${NO_SHOW_ID}`) && init?.method === "PATCH") {
    const body = JSON.parse(String(init.body)) as {
      attendance: string;
      copayAmount: number;
      copayPaid: boolean;
    };
    return Promise.resolve(
      jsonResponse({
        ...dayList[0]!.appointment,
        status: "ended",
        attendance: body.attendance,
        copayAmount: body.copayAmount,
        copayPaid: body.copayPaid,
      })
    );
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
});

describe("secretary attendance & copay", () => {
  it("shows the day's appointments with their attendance status", async () => {
    const user = userEvent.setup();
    await signInAndOpenAttendance(user);

    expect(await screen.findByRole("button", { name: /Ana Pérez/ })).toBeInTheDocument();
    expect(screen.getByText("No-show")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/admin\/appointments\?date=/),
      expect.objectContaining({ headers: expect.anything() })
    );
  });

  it("pre-fills the copay from the patient's insurance, records attendance, and posts the PATCH", async () => {
    const user = userEvent.setup();
    await signInAndOpenAttendance(user);

    await user.click(await screen.findByRole("button", { name: /Ana Pérez/ }));
    expect(
      screen.getByText(/This patient was marked no-show automatically/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Copay \(booked from IOMA\)/)).toHaveValue(5000);

    await user.clear(screen.getByLabelText(/Copay \(booked from IOMA\)/));
    await user.type(screen.getByLabelText(/Copay \(booked from IOMA\)/), "4500");
    await user.click(screen.getByLabelText("Copay paid"));
    await user.click(screen.getByRole("button", { name: "Mark attended & record copay" }));

    expect(
      await screen.findByText(/Copay paid — appointment marked attended/)
    ).toBeInTheDocument();

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === `/api/admin/appointments/${NO_SHOW_ID}` && init?.method === "PATCH"
    );
    expect(patchCall).toBeDefined();
    const headers = new Headers(patchCall![1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer signed-token");
    expect(JSON.parse(String(patchCall![1]?.body))).toEqual({
      attendance: "attended",
      copayAmount: 4500,
      copayPaid: true,
    });
  });

  it("pre-fills from the booked copay on the appointment, not the live insurance amount", async () => {
    const record = detailRecord({ attendance: "no_show", status: "ended" });
    const divergent = {
      ...record,
      appointment: { ...record.appointment, copayAmount: 3500 },
    };
    fetchMock.mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/login" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ token: "signed-token", user: secretaryUser }));
      }
      if (url.startsWith("/api/admin/appointments?date=")) {
        return Promise.resolve(jsonResponse([divergent]));
      }
      return Promise.resolve(jsonResponse({ error: "not found" }, 404));
    });

    const user = userEvent.setup();
    await signInAndOpenAttendance(user);
    await user.click(await screen.findByRole("button", { name: /Ana Pérez/ }));

    // The insurance copay is 5000 but the appointment was booked at 3500; the
    // form shows the booked amount (spec: the appointment carries the copay).
    expect(screen.getByLabelText(/Copay \(booked from IOMA\)/)).toHaveValue(3500);
  });

  it("reopens the attendance form for the next appointment after a record", async () => {
    const user = userEvent.setup();
    await signInAndOpenAttendance(user);

    await user.click(await screen.findByRole("button", { name: /Ana Pérez/ }));
    await user.click(screen.getByRole("button", { name: "Mark attended & record copay" }));
    await screen.findByText(/appointment marked attended/);

    await user.click(screen.getByRole("button", { name: /Ana Pérez/ }));

    expect(
      await screen.findByRole("button", { name: "Mark attended & record copay" })
    ).toBeInTheDocument();
  });

  it("rejects an empty copay amount without submitting", async () => {
    const user = userEvent.setup();
    await signInAndOpenAttendance(user);

    await user.click(await screen.findByRole("button", { name: /Ana Pérez/ }));
    await user.clear(screen.getByLabelText(/Copay \(booked from IOMA\)/));
    await user.click(screen.getByRole("button", { name: "Mark attended & record copay" }));

    expect(await screen.findByText("Enter a valid copay amount")).toBeInTheDocument();
    const patchCalls = fetchMock.mock.calls.filter(
      ([url, init]) => String(url).includes("/api/admin/appointments/") && init?.method === "PATCH"
    );
    expect(patchCalls).toHaveLength(0);
  });
});