import { HttpError } from "./httpError";

export class SlotUnavailableError extends HttpError {
  constructor() {
    super(409, "that slot is no longer available", "SlotUnavailableError");
  }
}