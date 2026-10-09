import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { databaseConfigured, pool } from "@workspace/db";

const DATABASE_HEALTHCHECK_TIMEOUT_MS = 4_000;
let databaseProbe: Promise<boolean> | undefined;

function databaseIsReady() {
  if (!databaseConfigured) return Promise.resolve(process.env.NODE_ENV !== "production");
  if (!databaseProbe) {
    databaseProbe = pool
      .query('SELECT 1 FROM "returnhaul_runtime_state" LIMIT 1')
      .then(() => true, () => false)
      .finally(() => {
        databaseProbe = undefined;
      });
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timeoutId = setTimeout(() => resolve(false), DATABASE_HEALTHCHECK_TIMEOUT_MS);
  });
  return Promise.race([databaseProbe, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const ready = await databaseIsReady();
  const data = HealthCheckResponse.parse({ status: ready ? "ok" : "unavailable" });
  res.status(ready ? 200 : 503).json(data);
});

export default router;
