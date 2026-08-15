import express from "express";
import "../config/env";
import { catalogRouter } from "./api/catalog";
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

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`Next Visit API listening on http://localhost:${port}`);
  });
}

export default app;