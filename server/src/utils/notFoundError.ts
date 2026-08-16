import { HttpError } from "./httpError";

export class NotFoundError extends HttpError {
  constructor(resource: string) {
    super(404, `${resource} not found`, "NotFoundError");
  }
}