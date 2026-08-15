import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingFlow } from "../src/features/booking";

const cardio = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Cardiology" };
const derma = { id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12", name: "Dermatology" };

const consultaCardio = {
  id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
  specialtyId: cardio.id,
  name: "Cardiology consultation",
  durationMinutes: 30,
};
const consultaDerma = {
  id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15",
  specialtyId: derma.id,
  name: "Dermatology consultation",
  durationMinutes: 30,
};

const maria = {
  id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16",
  specialtyId: cardio.id,
  firstName: "María",
  lastName: "González",
};
const jorge = {
  id: "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a17",
  specialtyId: cardio.id,
  firstName: "Jorge",
  lastName: "Fernández",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

async function defaultFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  if (url === "/api/specialties") {
    return jsonResponse([cardio, derma]);
  }
  if (url === `/api/specialties/${cardio.id}/types`) {
    return jsonResponse([consultaCardio]);
  }
  if (url === `/api/specialties/${derma.id}/types`) {
    return jsonResponse([consultaDerma]);
  }
  if (url === `/api/types/${consultaCardio.id}/doctors`) {
    return jsonResponse([maria, jorge]);
  }
  if (url.includes(`/api/doctors/${maria.id}/slots`)) {
    return jsonResponse([
      { date: "2026-09-07", startTime: "09:00", endTime: "09:30", available: true },
      { date: "2026-09-07", startTime: "09:30", endTime: "10:00", available: false },
    ]);
  }
  return jsonResponse({ error: "not found" }, 404);
}

const fetchMock = vi.fn(defaultFetch);

beforeEach(() => {
  fetchMock.mockClear();
  fetchMock.mockImplementation(defaultFetch);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BookingFlow — catalog browsing steps", () => {
  it("advances specialty → type → doctor, only after a selection", async () => {
    const user = userEvent.setup();
    render(<BookingFlow />);

    expect(
      await screen.findByRole("heading", { name: "Which specialty do you need?" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Which appointment type?" })
    ).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Cardiology" }));

    expect(
      await screen.findByRole("heading", { name: "Which appointment type?" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Which doctor/ })
    ).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Cardiology consultation/ }));

    expect(
      await screen.findByRole("heading", { name: /Which doctor/ })
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "María González" })).toBeInTheDocument();
  });

  it("retries a failed step fetch from the retry button", async () => {
    let fail = true;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/specialties") {
        if (fail) {
          fail = false;
          return jsonResponse({ error: "boom" }, 500);
        }
        return jsonResponse([cardio, derma]);
      }
      return jsonResponse({ error: "not found" }, 404);
    });

    const user = userEvent.setup();
    render(<BookingFlow />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Retry/ }));

    expect(await screen.findByRole("button", { name: "Cardiology" })).toBeInTheDocument();
  });

  it("preserves previous selections when navigating back", async () => {
    const user = userEvent.setup();
    render(<BookingFlow />);

    await user.click(await screen.findByRole("button", { name: "Cardiology" }));
    await user.click(await screen.findByRole("button", { name: /Cardiology consultation/ }));
    await user.click(await screen.findByRole("button", { name: "María González" }));

    await user.click(screen.getByRole("button", { name: /Back/ }));
    await user.click(screen.getByRole("button", { name: /Back/ }));
    await user.click(screen.getByRole("button", { name: /Back/ }));

    expect(screen.getByRole("button", { name: "Cardiology" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Cardiology" }));
    expect(screen.getByRole("button", { name: /Cardiology consultation/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: /Cardiology consultation/ }));
    expect(screen.getByRole("button", { name: "María González" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("keeps the chosen type and doctor when re-picking the same specialty", async () => {
    const user = userEvent.setup();
    render(<BookingFlow />);

    await user.click(await screen.findByRole("button", { name: "Cardiology" }));
    await user.click(await screen.findByRole("button", { name: /Cardiology consultation/ }));
    await user.click(await screen.findByRole("button", { name: "María González" }));

    await user.click(screen.getByRole("button", { name: /Back/ }));
    await user.click(screen.getByRole("button", { name: /Back/ }));
    await user.click(screen.getByRole("button", { name: /Back/ }));
    await user.click(screen.getByRole("button", { name: "Cardiology" }));

    expect(screen.getByRole("button", { name: /Cardiology consultation/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: /Cardiology consultation/ }));
    expect(screen.getByRole("button", { name: "María González" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("advances to the slot grid after picking a doctor and lets the patient pick a slot", async () => {
    const user = userEvent.setup();
    render(<BookingFlow />);

    await user.click(await screen.findByRole("button", { name: "Cardiology" }));
    await user.click(await screen.findByRole("button", { name: /Cardiology consultation/ }));
    await user.click(await screen.findByRole("button", { name: "María González" }));

    expect(
      await screen.findByRole("heading", { name: "Pick a time for your appointment" })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /Lunes, 7 de septiembre/ })
    ).toBeInTheDocument();

    const available = await screen.findByRole("button", { name: /09:00/ });
    expect(available).not.toHaveAttribute("aria-disabled");
    const unavailable = screen.getByRole("button", { name: /09:30/ });
    expect(unavailable).toHaveAttribute("aria-disabled", "true");

    await user.click(available);
    expect(screen.getByText(/You chose 2026-09-07 at 09:00/)).toBeInTheDocument();
  });

  it("clears downstream selections when picking a different specialty", async () => {
    const user = userEvent.setup();
    render(<BookingFlow />);

    await user.click(await screen.findByRole("button", { name: "Cardiology" }));
    await user.click(await screen.findByRole("button", { name: /Cardiology consultation/ }));

    await user.click(screen.getByRole("button", { name: /Back/ }));
    await user.click(screen.getByRole("button", { name: /Back/ }));
    await user.click(screen.getByRole("button", { name: "Dermatology" }));

    expect(
      await screen.findByRole("button", { name: /Dermatology consultation/ })
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", { name: /Cardiology consultation/ })
    ).not.toBeInTheDocument();
  });
});