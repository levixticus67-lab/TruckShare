import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Keep-alive: mirror the Employee-- deployment by pinging the public
  // health endpoint every five minutes while the Render process is running.
  const backendUrl = (
    process.env["RENDER_EXTERNAL_URL"] ??
    process.env["BACKEND_URL"] ??
    ""
  ).replace(/\/$/, "");
  if (backendUrl) {
    setInterval(() => {
      fetch(`${backendUrl}/api/healthz`)
        .then(() => logger.debug("Keep-alive ping sent"))
        .catch((pingErr) => logger.warn({ err: pingErr }, "Keep-alive ping failed"));
    }, 5 * 60 * 1000);
    logger.info({ backendUrl }, "Keep-alive pinger started (5 min interval)");
  } else {
    logger.warn("RENDER_EXTERNAL_URL / BACKEND_URL not set — keep-alive pinger disabled");
  }
});
