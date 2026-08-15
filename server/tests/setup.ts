import { getTestDatabaseUrl } from "../config/env";

// dotenv never overrides existing vars, so this wins over .env.
process.env.DATABASE_URL = getTestDatabaseUrl();