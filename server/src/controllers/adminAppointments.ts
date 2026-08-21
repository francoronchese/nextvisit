import type { Request, Response } from "express";
import { appointmentDetailWithInsuranceSchema, appointmentSchema, doctorAppointmentSchema, utcToClinicParts } from "@nextvisit/shared";
import { attendanceService } from "../services/attendance";
import { secretaryAppointmentService } from "../services/appointments";
import { doctorAppointmentsService } from "../services/doctorAppointments";
import { parseIdParam } from "../utils/parseIdParam";
import { parseRequest, respondWithResource } from "../utils/respond";
import { dateQuerySchema, recordAttendanceSchema, rescheduleAppointmentSchema } from "../validators/appointments";

// One GET serves both staff roles with role-shaped bodies: the doctor sees
// only their own upcoming appointments (the session's linked doctor), the
// secretary sees a whole clinic-local day for the attendance flow.
export async function getAppointments(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (user?.role === "doctor") {
    await respondWithResource(
      res,
      () => doctorAppointmentsService.listUpcoming(user.doctorId),
      { schema: doctorAppointmentSchema.array() }
    );
    return;
  }
  const query = parseRequest(dateQuerySchema, req.query, res, "invalid query");
  if (!query) return;
  const date = query.date ?? utcToClinicParts(new Date()).date;
  await respondWithResource(
    res,
    () => attendanceService.listForDay(date),
    { schema: appointmentDetailWithInsuranceSchema.array() }
  );
}

export async function recordAttendance(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  const body = parseRequest(recordAttendanceSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(
    res,
    () => attendanceService.record(id, body),
    { schema: appointmentSchema }
  );
}

// Secretary cancel/reschedule (spec: after the cancellation window closes only
// the secretary can change an appointment). The secretary works by appointment
// id — no one-time link involved — so these POSTs sit next to the attendance
// PATCH as the admin appointment management surface.
export async function cancelAppointment(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  await respondWithResource(
    res,
    () => secretaryAppointmentService.cancel(id),
    { schema: appointmentSchema }
  );
}

export async function rescheduleAppointment(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req, res);
  if (!id) return;
  const body = parseRequest(rescheduleAppointmentSchema, req.body, res, "invalid body");
  if (!body) return;
  // The wire spells the slot {date, startTime}; the service wants a ClinicLocalTime.
  await respondWithResource(
    res,
    () =>
      secretaryAppointmentService.reschedule(id, {
        slot: { date: body.date, time: body.startTime },
      }),
    { schema: appointmentSchema }
  );
}