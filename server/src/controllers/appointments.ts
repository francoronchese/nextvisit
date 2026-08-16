import type { Request, Response } from "express";
import { appointmentDetailSchema, appointmentSchema } from "@nextvisit/shared";
import { appointmentManagementService } from "../services/appointments";
import { parseRequest, respondWithResource } from "../utils/respond";
import { rescheduleAppointmentSchema, tokenParamSchema } from "../validators/appointments";

function parseToken(req: Request, res: Response): string | undefined {
  const params = parseRequest(tokenParamSchema, req.params, res, "invalid token");
  return params?.token;
}

export async function getAppointmentByToken(req: Request, res: Response): Promise<void> {
  const token = parseToken(req, res);
  if (!token) return;
  await respondWithResource(
    res,
    () => appointmentManagementService.getByToken(token),
    { schema: appointmentDetailSchema }
  );
}

export async function cancelAppointment(req: Request, res: Response): Promise<void> {
  const token = parseToken(req, res);
  if (!token) return;
  await respondWithResource(
    res,
    () => appointmentManagementService.cancel(token),
    { schema: appointmentSchema }
  );
}

export async function rescheduleAppointment(req: Request, res: Response): Promise<void> {
  const token = parseToken(req, res);
  if (!token) return;
  const body = parseRequest(rescheduleAppointmentSchema, req.body, res, "invalid body");
  if (!body) return;
  await respondWithResource(
    res,
    () => appointmentManagementService.reschedule(token, body),
    { schema: appointmentSchema }
  );
}