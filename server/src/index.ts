import express from "express";
import "../config/env";
import { adminRouter } from "./api/admin";
import { appointmentsRouter } from "./api/appointments";
import { bookingsRouter } from "./api/bookings";
import { catalogRouter } from "./api/catalog";
import { noShowsRouter } from "./api/noShows";
import { remindersRouter } from "./api/reminders";
import { slotsRouter } from "./api/slots";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", catalogRouter);
app.use("/api", slotsRouter);
app.use("/api", bookingsRouter);
app.use("/api", appointmentsRouter);
// adminRouter applies requireAdminAuth to every /api request it sees, so any
// router that must stay public (reminders, no-shows) is mounted before it.
app.use("/api", remindersRouter);
app.use("/api", noShowsRouter);
app.use("/api", adminRouter);

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Next Visit API listening on http://localhost:${port}`);
  });
}

export default app;