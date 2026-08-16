import { describe, expect, it } from "vitest";
import {
  appointmentSchema,
  appointmentStatusEnum,
  attendanceEnum,
  blockReasonEnum,
  bookingChannelEnum,
  doctorSchema,
  patientSchema,
  userRoleEnum,
} from "../src/types";

describe("appointmentSchema", () => {
  const validAppointment = {
    id: "2d157f79-aaf5-46b5-ad32-03f8f896878e",
    patientId: "2d157f79-aaf5-46b5-ad32-03f8f896878e",
    doctorId: "2d157f79-aaf5-46b5-ad32-03f8f896878e",
    appointmentTypeId: "2d157f79-aaf5-46b5-ad32-03f8f896878e",
    startsAt: "2026-09-01T10:00:00Z",
    durationMinutes: 30,
    bookingChannel: "web",
    status: "scheduled",
    attendance: "pending",
    copayAmount: 5000,
    copayPaid: false,
    createdAt: "2026-08-14T10:00:00Z",
  };

  it("parses a valid appointment", () => {
    expect(appointmentSchema.parse(validAppointment)).toEqual(validAppointment);
  });

  it("rejects an invalid status", () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      status: "invented",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative copay", () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      copayAmount: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an ended appointment without attendance", () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      status: "ended",
      attendance: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an ended appointment marked no_show", () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      status: "ended",
      attendance: "no_show",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a scheduled appointment with attendance", () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      attendance: "attended",
    });
    expect(result.success).toBe(false);
  });
});

describe("enums", () => {
  it("books through the three channels", () => {
    expect(bookingChannelEnum.options).toEqual(["web", "front_desk", "phone"]);
  });

  it("pins the appointment lifecycle to three states", () => {
    expect(appointmentStatusEnum.options).toEqual(["scheduled", "cancelled", "ended"]);
  });

  it("tracks no-show as attendance, not a lifecycle state", () => {
    expect(attendanceEnum.options).toEqual(["pending", "attended", "no_show"]);
  });

  it("defines the three staff roles", () => {
    expect(userRoleEnum.options).toEqual(["admin", "secretary", "doctor"]);
  });

  it("pins the block reason vocabulary to holiday and absence", () => {
    expect(blockReasonEnum.options).toEqual(["holiday", "absence"]);
  });
});

describe("patientSchema", () => {
  it("requires a 7-8 digit DNI", () => {
    const base = {
      id: "2d157f79-aaf5-46b5-ad32-03f8f896878e",
      firstName: "Ana",
      lastName: "López",
      healthInsuranceId: "2d157f79-aaf5-46b5-ad32-03f8f896878e",
      phone: "555-0100",
    };
    expect(patientSchema.safeParse({ ...base, dni: "30123456" }).success).toBe(true);
    expect(patientSchema.safeParse({ ...base, dni: "123" }).success).toBe(false);
    expect(patientSchema.safeParse({ ...base, dni: "abcdefgh" }).success).toBe(false);
  });
});

describe("doctorSchema", () => {
  it("parses a doctor", () => {
    const doctor = {
      id: "2d157f79-aaf5-46b5-ad32-03f8f896878e",
      specialtyId: "2d157f79-aaf5-46b5-ad32-03f8f896878e",
      firstName: "María",
      lastName: "González",
    };
    expect(doctorSchema.parse(doctor)).toEqual(doctor);
  });
});

