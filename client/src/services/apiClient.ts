const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

let staffSessionToken: string | null = null;

export function setStaffSessionToken(token: string): void {
  staffSessionToken = token;
}

export function getStaffSessionToken(): string | null {
  return staffSessionToken;
}

export function clearStaffSessionToken(): void {
  staffSessionToken = null;
}

function isAdminPath(path: string): boolean {
  return path.startsWith("/api/admin");
}

function headersFor(path: string, extra: Record<string, string> = {}): HeadersInit {
  const headers = { ...extra };
  if (isAdminPath(path) && staffSessionToken) {
    headers.Authorization = `Bearer ${staffSessionToken}`;
  }
  return headers;
}

async function request<T>(path: string, init: RequestInit, expectBody: true): Promise<T>;
async function request<T>(path: string, init: RequestInit, expectBody: false): Promise<void>;
async function request<T>(
  path: string,
  init: RequestInit,
  expectBody: boolean
): Promise<T | void> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Non-JSON error bodies keep the generic message.
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) {
    if (expectBody) {
      throw new Error(`Unexpected empty response from ${path}`);
    }
    return;
  }
  return (await response.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { headers: headersFor(path) }, true);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(
    path,
    {
      method: "POST",
      headers: headersFor(path, { "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    },
    true
  );
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(
    path,
    {
      method: "PUT",
      headers: headersFor(path, { "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    },
    true
  );
}

export async function apiDelete(path: string): Promise<void> {
  await request(path, { method: "DELETE", headers: headersFor(path) }, false);
}