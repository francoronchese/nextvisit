import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminLoginPage } from "../src/features/admin";
import { clearStaffSessionToken } from "../src/services/apiClient";

const adminUser = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  email: "admin@nextvisit.ar",
  role: "admin",
  createdAt: "2026-08-15T00:00:00.000Z",
};

const osde = {
  id: "a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
  name: "OSDE",
  copayAmount: 12000,
};

const pamu = { id: "a3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13", name: "PAMI", copayAmount: 3000 };

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchInput = RequestInfo | URL;
type FetchInit = RequestInit | undefined;

function defaultFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  if (url === "/api/admin/login" && init?.method === "POST") {
    return Promise.resolve(jsonResponse({ token: "signed-token", user: adminUser }));
  }
  if (url === "/api/admin/users") {
    return Promise.resolve(jsonResponse([]));
  }
  if (url === "/api/admin/health-insurances") {
    return Promise.resolve(jsonResponse([osde, pamu]));
  }
  return Promise.resolve(jsonResponse({ error: "not found" }, 404));
}

const fetchMock = vi.fn(defaultFetch);

async function signInAsAdmin(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  render(<AdminLoginPage />);
  await user.type(screen.getByLabelText("Email"), adminUser.email);
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.click(screen.getByRole("button", { name: /Sign in/ }));
  await screen.findByRole("heading", { name: "Admin panel" });
}

beforeEach(() => {
  clearStaffSessionToken();
  fetchMock.mockClear();
  fetchMock.mockImplementation(defaultFetch);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin health insurance copay table", () => {
  it("lists each insurance with its copay amount", async () => {
    const user = userEvent.setup();
    await signInAsAdmin(user);

    const osdeEntry = screen.getByText("OSDE").closest("li");
    expect(osdeEntry).toBeInTheDocument();
    expect(within(osdeEntry!).getByText("$12.000")).toBeInTheDocument();

    const pamuEntry = screen.getByText("PAMI").closest("li");
    expect(within(pamuEntry!).getByText("$3.000")).toBeInTheDocument();
  });

  it("adds an insurance and refreshes the table", async () => {
    const insurances = [osde, pamu];
    fetchMock.mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/login" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ token: "signed-token", user: adminUser }));
      }
      if (url === "/api/admin/users") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === "/api/admin/health-insurances" && init?.method === "POST") {
        const body = JSON.parse(String(init?.body)) as { name: string; copayAmount: number };
        const created = {
          id: "a4eebc99-9c0b-4ef8-bb6d-6bb9bd380a14",
          name: body.name,
          copayAmount: body.copayAmount,
        };
        insurances.push(created);
        return Promise.resolve(jsonResponse(created, 201));
      }
      if (url === "/api/admin/health-insurances") {
        return Promise.resolve(jsonResponse(insurances));
      }
      return Promise.resolve(jsonResponse({ error: "not found" }, 404));
    });

    const user = userEvent.setup();
    await signInAsAdmin(user);

    await user.type(screen.getByLabelText("Insurance name"), "Swiss Medical");
    await user.type(screen.getByLabelText("Copay amount"), "15000");
    await user.click(screen.getByRole("button", { name: /Add insurance/ }));

    expect(await screen.findByText("Swiss Medical")).toBeInTheDocument();
    expect(screen.getByLabelText("Insurance name")).toHaveValue("");

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === "/api/admin/health-insurances" && init?.method === "POST"
    );
    expect(postCall).toBeDefined();
    const headers = new Headers(postCall![1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer signed-token");
    expect(JSON.parse(String(postCall![1]?.body))).toEqual({
      name: "Swiss Medical",
      copayAmount: 15000,
    });
  });

  it("edits an insurance name and copay amount", async () => {
    const insurances = [osde, pamu];
    fetchMock.mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/login" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ token: "signed-token", user: adminUser }));
      }
      if (url === "/api/admin/users") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === `/api/admin/health-insurances/${osde.id}` && init?.method === "PUT") {
        const body = JSON.parse(String(init?.body)) as { name: string; copayAmount: number };
        Object.assign(osde, body);
        return Promise.resolve(jsonResponse(osde));
      }
      if (url === "/api/admin/health-insurances") {
        return Promise.resolve(jsonResponse(insurances));
      }
      return Promise.resolve(jsonResponse({ error: "not found" }, 404));
    });

    const user = userEvent.setup();
    await signInAsAdmin(user);

    const osdeEntry = screen.getByText("OSDE").closest("li");
    await user.click(within(osdeEntry!).getByRole("button", { name: /Edit/ }));

    const nameInput = screen.getByDisplayValue("OSDE");
    await user.clear(nameInput);
    await user.type(nameInput, "OSDE 210");
    const copayInput = screen.getByDisplayValue("12000");
    await user.clear(copayInput);
    await user.type(copayInput, "13500");
    await user.click(screen.getByRole("button", { name: /Save/ }));

    expect(await screen.findByText("OSDE 210")).toBeInTheDocument();
    expect(screen.getByText("$13.500")).toBeInTheDocument();

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === `/api/admin/health-insurances/${osde.id}` && init?.method === "PUT"
    );
    expect(JSON.parse(String(putCall![1]?.body))).toEqual({ name: "OSDE 210", copayAmount: 13500 });
  });

  it("deletes an insurance", async () => {
    const insurances = [osde, pamu];
    fetchMock.mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/login" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ token: "signed-token", user: adminUser }));
      }
      if (url === "/api/admin/users") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === `/api/admin/health-insurances/${pamu.id}` && init?.method === "DELETE") {
        insurances.splice(insurances.indexOf(pamu), 1);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url === "/api/admin/health-insurances") {
        return Promise.resolve(jsonResponse(insurances));
      }
      return Promise.resolve(jsonResponse({ error: "not found" }, 404));
    });

    const user = userEvent.setup();
    await signInAsAdmin(user);

    const pamuEntry = screen.getByText("PAMI").closest("li");
    await user.click(within(pamuEntry!).getByRole("button", { name: /Delete/ }));

    await waitFor(() => expect(screen.queryByText("PAMI")).not.toBeInTheDocument());
  });

  it("shows the server error when the name is already taken", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/admin/login" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ token: "signed-token", user: adminUser }));
      }
      if (url === "/api/admin/users") {
        return Promise.resolve(jsonResponse([]));
      }
      if (url === "/api/admin/health-insurances" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({ error: "a health insurance with that name already exists" }, 409)
        );
      }
      if (url === "/api/admin/health-insurances") {
        return Promise.resolve(jsonResponse([osde]));
      }
      return Promise.resolve(jsonResponse({ error: "not found" }, 404));
    });

    const user = userEvent.setup();
    await signInAsAdmin(user);

    await user.type(screen.getByLabelText("Insurance name"), osde.name);
    await user.type(screen.getByLabelText("Copay amount"), "13000");
    await user.click(screen.getByRole("button", { name: /Add insurance/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "a health insurance with that name already exists"
    );
    expect(screen.getByLabelText("Insurance name")).toHaveValue(osde.name);
  });
});
