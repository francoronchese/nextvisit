import { HttpError } from "./httpError";

export class TooManyAppointmentsError extends HttpError {
  constructor() {
    super(422, "you already have 3 future appointments", "TooManyAppointmentsError");
  }
}