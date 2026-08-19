import { describe, expect, it, vi } from "vitest";
import type { DoctorAppointment } from "@nextvisit/shared";
import type { DoctorAppointmentQueries } from "../../src/db/queries/appointments";
import { createDoctorAppointmentService } from "../../src/services/doctorAppointments";

const upcoming: DoctorAppointment = {
  appointment: {
    id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18",
    startsAt: "2026-09-07T12:00:00.000Z",
    durationMinutes: 30,
    status: "scheduled",
  },
  patient: { firstName: "Ana", lastName: "Pérez", dni: "30111222" },
  appointmentType: { name: "Cardiology consultation" },
};

function buildQueries(
  overrides: Partial<DoctorAppointmentQueries> = {}
): DoctorAppointmentQueries {
  return {
    listUpcomingForDoctor: vi.fn(() => Promise.resolve([upcoming])),
    ...overrides,
  };
}

describe("doctor appointments service", () => {
  it("lists the upcoming appointments of the signed-in doctor", async () => {
    const queries = buildQueries();
    const service = createDoctorAppointmentService(queries);
    const doctorId = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16";

    const appointments = await service.listUpcoming(doctorId);

    expect(appointments).toEqual([upcoming]);
    expect(queries.listUpcomingForDoctor).toHaveBeenCalledWith(doctorId);
  });

  it("returns an empty list for a doctor session with no linked doctor record", async () => {
    const queries = buildQueries();
    const service = createDoctorAppointmentService(queries);

    await expect(service.listUpcoming(undefined)).resolves.toEqual([]);
    expect(queries.listUpcomingForDoctor).not.toHaveBeenCalled();
  });
});