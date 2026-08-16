// Base for every error the controllers turn into an HTTP response with the
// message as the body: the status travels with the error instead of living in
// an instanceof cascade in each controller.
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string, name: string) {
    super(message);
    this.name = name;
    this.status = status;
  }
}

export function httpErrorStatus(error: unknown): number | undefined {
  return error instanceof HttpError ? error.status : undefined;
}