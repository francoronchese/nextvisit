// Base for every error the controllers turn into an HTTP response with the
// message as the body: the status travels with the error instead of living in
// an instanceof cascade in each controller. Domain errors are thrown as plain
// HttpError instances built by the factories in ./httpErrors.
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string, name: string) {
    super(message);
    this.name = name;
    this.status = status;
  }
}

export function httpError(status: number, message: string, name: string): HttpError {
  return new HttpError(status, message, name);
}

export function httpErrorStatus(error: unknown): number | undefined {
  return error instanceof HttpError ? error.status : undefined;
}