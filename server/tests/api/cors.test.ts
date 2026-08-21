import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/index";

const ALLOWED = "https://nextvisit.example.com";

// CLIENT_ORIGIN is read per request, so each test configures its own scenario.
describe("CORS allowlist", () => {
  afterEach(() => {
    delete process.env.CLIENT_ORIGIN;
  });

  it("echoes an allowlisted origin and allows the Authorization header", async () => {
    process.env.CLIENT_ORIGIN = `${ALLOWED}, https://staging.nextvisit.example.com`;
    const res = await request(app)
      .get("/health")
      .set("Origin", ALLOWED)
      .expect(200);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["access-control-allow-headers"]).toContain("Authorization");
  });

  it("answers a preflight with 204 and the allowed methods", async () => {
    process.env.CLIENT_ORIGIN = `${ALLOWED}`;
    const res = await request(app)
      .options("/api/admin/login")
      .set("Origin", ALLOWED)
      .set("Access-Control-Request-Method", "POST")
      .expect(204);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("sends no CORS headers to an unknown origin", async () => {
    process.env.CLIENT_ORIGIN = ALLOWED;
    const res = await request(app)
      .get("/health")
      .set("Origin", "https://evil.example.com")
      .expect(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("adds no CORS headers when CLIENT_ORIGIN is unset (same-origin deploy)", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", ALLOWED)
      .expect(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
