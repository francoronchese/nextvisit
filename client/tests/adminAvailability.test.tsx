import { fireEvent, render, screen, within } from "@testing-library/react";
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

const doctor = {
  id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16",
  specialtyId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  firstName: "María",
  lastName: "González",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

const fetchMock = vi.fn();

type StoredWindow = { id: string; doctorId: string; weekday: number; startTime: string; endTime: string };
type StoredBlock = { id: string; doctorId: string; date: string; startTime: string; endTime: string; reason: string };

beforeEach(() => {
  clearStaffSessionToken();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);

  const windows: StoredWindow[] = [];
  const blocks: StoredBlock[] = [];
  let nextId = 1;

  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url === "/api/admin/login" && method === "POST") {
      return jsonResponse({ token: "signed-token", user: secretaryUser });
    }
    if (url === "/api/admin/doctors") {
      return jsonResponse([doctor]);
    }
    if (url.startsWith("/api/admin/availability?doctorId=")) {
      return jsonResponse(windows);
    }
    if (url === "/api/admin/availability" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Omit<StoredWindow, "id">;
      const created: StoredWindow = { id: `window-${nextId++}`, ...body };
      windows.push(created);
      return jsonResponse(created, 201);
    }
    if (url.startsWith("/api/admin/availability-blocks?doctorId=")) {
      return jsonResponse(blocks);
    }
    if (url === "/api/admin/availability-blocks" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Omit<StoredBlock, "id">;
      const created: StoredBlock = { id: `block-${nextId++}`, ...body };
      blocks.push(created);
      return jsonResponse(created, 201);
    }
    return jsonResponse({ error: "not found" }, 404);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function signInAsSecretary() {
  const user = userEvent.setup();
  render(<AdminLoginPage />);
  await user.type(screen.getByLabelText("Email"), secretaryUser.email);
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.click(screen.getByRole("button", { name: /Sign in/ }));
}

describe("admin availability management", () => {
  it("signs in a secretary and shows the doctor selector with the availability sections", async () => {
    await signInAsSecretary();

    expect(await screen.findByLabelText("Doctor")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Doctor" })).toHaveTextContent("María González");
    expect(screen.getByRole("heading", { name: "Weekly hours" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Holidays and absences" })).toBeInTheDocument();
  });

  it("adds weekly hours for the selected doctor", async () => {
    await signInAsSecretary();
    await screen.findByLabelText("Doctor");

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Day"), "Tuesday");
    await user.click(screen.getByRole("button", { name: "Add weekly hours" }));

    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input) === "/api/admin/availability" && init?.method === "POST"
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(String(postCall![1]?.body))).toEqual({
      doctorId: doctor.id,
      weekday: 2,
      startTime: "09:00",
      endTime: "17:00",
    });

    expect(await screen.findByText(/Tuesday 09:00–17:00/)).toBeInTheDocument();
  });

  it("adds a block with a reason for the selected doctor", async () => {
    await signInAsSecretary();
    await screen.findByLabelText("Doctor");

    const user = userEvent.setup();
    const dateInput = screen.getByLabelText("Date");
    fireEvent.change(dateInput, { target: { value: "2026-09-07" } });
    await user.selectOptions(screen.getByLabelText("Reason"), "absence");
    await user.click(screen.getByRole("button", { name: "Add block" }));

    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input) === "/api/admin/availability-blocks" && init?.method === "POST"
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(String(postCall![1]?.body))).toEqual({
      doctorId: doctor.id,
      date: "2026-09-07",
      startTime: "09:00",
      endTime: "17:00",
      reason: "absence",
    });

    expect(await screen.findByText(/Lunes,? 7 de septiembre/i)).toBeInTheDocument();
  });

  it("shows an error when adding weekly hours fails", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url === "/api/admin/login" && method === "POST") {
        return jsonResponse({ token: "signed-token", user: secretaryUser });
      }
      if (url === "/api/admin/doctors") return jsonResponse([doctor]);
      if (url.startsWith("/api/admin/availability?doctorId=")) return jsonResponse([]);
      if (url.startsWith("/api/admin/availability-blocks?doctorId=")) return jsonResponse([]);
      if (url === "/api/admin/availability" && method === "POST") {
        return jsonResponse({ error: "doctor not found" }, 404);
      }
      return jsonResponse({ error: "not found" }, 404);
    });

    await signInAsSecretary();
    await screen.findByLabelText("Doctor");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add weekly hours" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("doctor not found");
  });

  it("rejects weekly hours whose end time is before the start time", async () => {
    await signInAsSecretary();
    await screen.findByLabelText("Doctor");

    const weeklySection = screen.getByRole("heading", { name: "Weekly hours" }).closest("section");
    expect(weeklySection).not.toBeNull();
    const start = within(weeklySection as HTMLElement).getByLabelText("Start");
    const end = within(weeklySection as HTMLElement).getByLabelText("End");
    fireEvent.change(start, { target: { value: "17:00" } });
    fireEvent.change(end, { target: { value: "09:00" } });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add weekly hours" }));

    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input) === "/api/admin/availability" && init?.method === "POST"
    );
    expect(postCall).toBeUndefined();
    expect(await screen.findByRole("alert")).toHaveTextContent("End time must be after start time");
  });
});