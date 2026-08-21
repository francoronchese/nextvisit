import type { NextFunction, Request, Response } from "express";

// Cross-origin is only needed when the SPA and the API deploy to different
// origins (Vercel). CLIENT_ORIGIN holds the comma-separated allowlist of client
// origins; unset means same-origin only and every foreign origin stays bare.
export function corsAllowlist(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const allowed = (process.env.CLIENT_ORIGIN ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  // Preflights have no route of their own; answer them here or Express 404s
  // them before the browser ever sees the CORS headers above.
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}
