import type { User } from "@nextvisit/shared";

export type LoginCredentials = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};