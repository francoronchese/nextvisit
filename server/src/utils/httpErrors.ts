import { httpError, type HttpError } from "./httpError";

// One place for every domain error a controller turns into an HTTP response.
// Plain instances rather than one class per error: the status + message carry
// everything, so a hierarchy of near-identical subclasses added nothing.
export function notFoundError(resource: string): HttpError {
  return httpError(404, `${resource} not found`, "NotFoundError");
}

export function slotUnavailableError(): HttpError {
  return httpError(409, "that slot is no longer available", "SlotUnavailableError");
}

export function tooManyAppointmentsError(): HttpError {
  return httpError(422, "you already have 3 future appointments", "TooManyAppointmentsError");
}

export function bookingRateLimitedError(): HttpError {
  return httpError(429, "too many booking attempts, please try again later", "BookingRateLimitedError");
}

export function invalidCredentialsError(): HttpError {
  return httpError(401, "invalid credentials", "InvalidCredentialsError");
}

export function cancellationWindowClosedError(): HttpError {
  return httpError(409, "the cancellation window has closed", "CancellationWindowClosedError");
}