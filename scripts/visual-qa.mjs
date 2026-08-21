// Visual QA (spec: "Puppeteer visual QA script capturing a screenshot of every
// view for manual review"). Run the dev stack first (`pnpm dev` + `pnpm db:seed`),
// then `pnpm visual-qa`. Screenshots land in scripts/visual-qa/screenshots/ and
// are meant to be reviewed by a human.
//
// Environment overrides:
//   APP_URL            public web origin (default http://localhost:5173)
//   VISUAL_QA_DIR      screenshot output directory
//   VISUAL_QA_PASSWORD seed staff password (default nextvisit123)
//   VISUAL_QA_SECRETARY_EMAIL / _ADMIN_EMAIL / _DOCTOR_EMAIL

import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer";

const BASE_URL = process.env.APP_URL ?? "http://localhost:5173";
const OUT_DIR = process.env.VISUAL_QA_DIR ?? "scripts/visual-qa/screenshots";
const PASSWORD = process.env.VISUAL_QA_PASSWORD ?? "nextvisit123";
const USERS = {
  secretary: process.env.VISUAL_QA_SECRETARY_EMAIL ?? "secretary@nextvisit.ar",
  admin: process.env.VISUAL_QA_ADMIN_EMAIL ?? "admin@nextvisit.ar",
  doctor: process.env.VISUAL_QA_DOCTOR_EMAIL ?? "maria.gonzalez@nextvisit.ar",
};

async function shot(page, name) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: true });
  console.log(`  captured ${name}.png`);
}

async function clickButton(page, label) {
  const [handle] = await page.$x(`//button[contains(., "${label}")]`);
  if (!handle) {
    throw new Error(`button "${label}" not found`);
  }
  await handle.click();
}

async function firstEnabledSlot(page) {
  await page.waitForXPath('//button[contains(@class, "rounded-xl") and not(@disabled)]');
  const [handle] = await page.$x('//button[contains(@class, "rounded-xl") and not(@disabled)]');
  if (!handle) {
    throw new Error("no enabled slot found");
  }
  return handle;
}

async function waitForText(page, text) {
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(expected),
    {},
    text
  );
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle0" });
  await page.type("#admin-email", email);
  await page.type("#admin-password", password);
  await clickButton(page, "Sign in");
}

async function logout(page) {
  await clickButton(page, "Sign out");
  await waitForText(page, "Sign in");
}

async function walkPublicBooking(page) {
  // 1. Patient step
  await page.goto(BASE_URL, { waitUntil: "networkidle0" });
  await waitForText(page, "Tell us who you are");
  await shot(page, "01-booking-patient");

  // 2. Specialty step
  await page.type("#patient-dni", "30111222");
  await page.type("#patient-first-name", "Ana");
  await page.type("#patient-last-name", "Pérez");
  await page.select("#patient-insurance", await page.$eval("#patient-insurance", (s) => s.options[1].value));
  await page.type("#patient-phone", "555-0101");
  await page.type("#patient-email", "ana@example.com");
  await clickButton(page, "Continue");
  await waitForText(page, "Which specialty");
  await shot(page, "02-booking-specialty");

  // 3. Type step
  await clickButton(page, "Cardiology");
  await waitForText(page, "Which appointment type");
  await shot(page, "03-booking-type");

  // 4. Doctor step
  await clickButton(page, "Cardiology consultation");
  await waitForText(page, "Which doctor");
  await shot(page, "04-booking-doctor");

  // 5. Slot step
  await clickButton(page, "María");
  await waitForText(page, "Pick a time");
  await shot(page, "05-booking-slot");

  // 6. Confirm step (screenshot before the booking is submitted)
  const slot = await firstEnabledSlot(page);
  await slot.click();
  await waitForText(page, "Confirm booking");
  await shot(page, "06-booking-confirm");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({ headless: "new" });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20_000);

    console.log("Walking the public booking flow…");
    await walkPublicBooking(page);

    console.log("Walking the admin surfaces…");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle0" });
    await waitForText(page, "Sign in");
    await shot(page, "10-admin-login");

    // Secretary: dashboard, booking-on-behalf, attendance.
    await login(page, USERS.secretary, PASSWORD);
    await waitForText(page, "Secretary panel");
    await shot(page, "11-secretary-dashboard");
    await clickButton(page, "Book an appointment");
    await waitForText(page, "Which specialty");
    await shot(page, "12-secretary-booking");
    await clickButton(page, "Attendance");
    await waitForText(page, "No appointments for this day");
    await shot(page, "13-secretary-attendance");

    // Admin: insurance + user management.
    await logout(page);
    await login(page, USERS.admin, PASSWORD);
    await waitForText(page, "Admin panel");
    await shot(page, "14-admin-dashboard");

    // Doctor: upcoming appointments (read-only).
    await logout(page);
    await login(page, USERS.doctor, PASSWORD);
    await waitForText(page, "Doctor panel");
    await shot(page, "15-doctor-dashboard");
  } finally {
    await browser.close();
  }

  console.log(`Visual QA complete. Screenshots in ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(`Visual QA failed: ${error.message}`);
  console.error("Is the dev stack running? Run `pnpm dev` and `pnpm db:seed` first.");
  process.exitCode = 1;
});