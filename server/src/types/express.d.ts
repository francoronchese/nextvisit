import type { User } from "@nextvisit/shared";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};