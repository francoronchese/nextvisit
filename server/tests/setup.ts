import { getAuthTokenSecret, getTestDatabaseUrl } from "../config/env";

// dotenv never overrides existing vars, so this wins over .env.
process.env.DATABASE_URL = getTestDatabaseUrl();
process.env.AUTH_TOKEN_SECRET = getAuthTokenSecret();
process.env.REMINDERS_SECRET = "test-reminders-secret";
// dotenv loaded the real key from .env; drop it so tests never touch Resend.
// The email contract test (tests/api/emails.test.ts) mocks the resend module
// and sets its own key before the app imports.
delete process.env.RESEND_API_KEY;
// The login rate limit counts every /api/admin/login call, and API suites log
// in repeatedly from supertest's single IP. Raise the cap globally; the
// rate-limit contract test lowers it for its own scenario and restores it.
process.env.MAX_LOGIN_ATTEMPTS = "1000";
