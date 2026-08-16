import { HttpError } from "./httpError";

export class BookingRateLimitedError extends HttpError {
  constructor() {
    super(429, "too many booking attempts, please try again later", "BookingRateLimitedError");
  }
}