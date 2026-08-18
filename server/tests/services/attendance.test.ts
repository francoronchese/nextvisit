import { describe, expect, it, vi } from "vitest";
import type { Appointment, AppointmentDetailWithInsurance } from "@nextvisit/shared";
import type { AppointmentManagementQueries } from "../../src/db/queries/appointments";
import { createAttendanceService, type AttendanceInput } from "../../src/services/attendance";

const patient = {
  id: "a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a17",
  dni: "30111222",
  firstName: "Ana",
  lastName: "Pérez",
  healthInsuranceId: "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a1a",
  phone: "555-0101",
  email: "ana@example.com",
};

const insurance = {
  id: patient.healthInsuranceId,
  name: "IOMA",
  copayAmount: 5000,
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

const scheduledAppointment: Appointment = {
  id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18",
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
};

const detail: AppointmentDetailWithInsurance = {
  appointment: scheduledAppointment,
  patient,
  doctor,
  specialty,
  appointmentType,
  insurance,
};

function buildQueries(
  overrides: Partial<AppointmentManagementQueries> = {}
): AppointmentManagementQueries {
  return {
    getOneTimeLinkByToken: vi.fn(() => Promise.resolve(undefined)),
    getAppointmentById: vi.fn(() => Promise.resolve(scheduledAppointment)),
    getAppointmentDetail: vi.fn(() => Promise.resolve(undefined)),
    markOneTimeLinkUsed: vi.fn(() => Promise.resolve()),
    cancelAppointment: vi.fn(() => Promise.resolve(undefined)),
    listAppointmentsForDay: vi.fn(() => Promise.resolve([detail])),
    updateAttendance: vi.fn(() =>
      Promise.resolve<Appointment>({ ...scheduledAppointment, status: "ended", attendance: "attended" })
    ),
    ...overrides,
  };
}

describe("attendance service", () => {
  it("lists a day's appointments carrying the insurance copay the form pre-fills", async () => {
    const queries = buildQueries();
    const service = createAttendanceService({ queries });

    const records = await service.listForDay("2026-09-07");

    expect(records).toEqual([detail]);
    expect(records[0]!.insurance.copayAmount).toBe(5000);
    // The query is scoped to the full clinic-local day in UTC (Argentina is
    // UTC-3, so the day 2026-09-07 runs 03:00Z → 03:00Z next day).
    expect(queries.listAppointmentsForDay).toHaveBeenCalledWith(
      "2026-09-07T03:00:00.000Z",
      "2026-09-08T03:00:00.000Z"
    );
  });

  it("marks a scheduled appointment attended, ending it and recording copay", async () => {
    const queries = buildQueries();
    const service = createAttendanceService({ queries });
    const input: AttendanceInput = { attendance: "attended", copayAmount: 4500, copayPaid: true };

    const updated = await service.record(scheduledAppointment.id, input);

    expect(updated.status).toBe("ended");
    expect(updated.attendance).toBe("attended");
    expect(queries.updateAttendance).toHaveBeenCalledWith(scheduledAppointment.id, input);
  });

  it("flips an automatically-marked no-show to attended when the patient arrives", async () => {
    const noShow: Appointment = { ...scheduledAppointment, status: "ended", attendance: "no_show" };
    const queries = buildQueries({
      getAppointmentById: vi.fn(() => Promise.resolve(noShow)),
      updateAttendance: vi.fn(() =>
        Promise.resolve<Appointment>({ ...noShow, attendance: "attended", copayPaid: true })
      ),
    });
    const service = createAttendanceService({ queries });

    const updated = await service.record(noShow.id, {
      attendance: "attended",
      copayAmount: 5000,
      copayPaid: true,
    });

    expect(updated.status).toBe("ended");
    expect(updated.attendance).toBe("attended");
    expect(queries.updateAttendance).toHaveBeenCalledWith(noShow.id, {
      attendance: "attended",
      copayAmount: 5000,
      copayPaid: true,
    });
  });

  it("rejects recording attendance for an unknown appointment", async () => {
    const queries = buildQueries({
      getAppointmentById: vi.fn(() => Promise.resolve(undefined)),
    });
    const service = createAttendanceService({ queries });

    await expect(
      service.record("b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a18", {
        attendance: "attended",
        copayAmount: 5000,
        copayPaid: true,
      })
    ).rejects.toMatchObject({ status: 404 });
    expect(queries.updateAttendance).not.toHaveBeenCalled();
  });

  it("rejects recording attendance on a cancelled appointment", async () => {
    const queries = buildQueries({
      getAppointmentById: vi.fn(() =>
        Promise.resolve<Appointment>({ ...scheduledAppointment, status: "cancelled" })
      ),
    });
    const service = createAttendanceService({ queries });

    await expect(
      service.record(scheduledAppointment.id, {
        attendance: "attended",
        copayAmount: 5000,
        copayPaid: true,
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(queries.updateAttendance).not.toHaveBeenCalled();
  });
});