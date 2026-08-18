import type { Request, Response } from "express";
import { appointmentDetailWithInsuranceSchema, appointmentSchema, utcToClinicParts } from "@nextvisit/shared";
import { attendanceService } from "../services/attendance";
import { parseIdParam } from "../utils/parseIdParam";
import { parseRequest, respondWithResource } from "../utils/respond";
import { dateQuerySchema, recordAttendanceSchema } from "../validators/appointments";

export async function getAppointmentsByDate(req: Request, res: Response): Promise<void> {
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