import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const apiEntry = fileURLToPath(new URL("../dist/index.mjs", import.meta.url));
const packageRoot = fileURLToPath(new URL("..", import.meta.url));

function startServer(port) {
  const child = spawn(process.execPath, [apiEntry], {
    cwd: packageRoot,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      DEV_ADMIN_ACCESS: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.logs = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      child.logs = (child.logs + chunk).slice(-12000);
    });
  }
  return child;
}

async function waitForServer(child, baseUrl) {
  let lastFailure = "no response";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error("API process exited before becoming ready. " + child.logs);
    }
    try {
      const response = await fetch(baseUrl + "/api/healthz");
      await response.arrayBuffer();
      if (response.status === 200) return;
      lastFailure = "health endpoint returned " + response.status;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    await delay(150);
  }
  throw new Error("API did not become ready: " + lastFailure + ". " + child.logs);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([exited, delay(4000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

test("a stale API instance gets a conflict instead of overwriting newer state", { timeout: 30000 }, async (t) => {
  const ports = [5100, 5101];
  const servers = ports.map(startServer);
  t.after(async () => Promise.all(servers.map(stopServer)));
  const baseUrls = ports.map((port) => "http://127.0.0.1:" + port);
  await Promise.all(servers.map((server, index) => waitForServer(server, baseUrls[index])));

  const logins = await Promise.all(baseUrls.map(async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/auth/dev-admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const payload = await response.json();
    assert.equal(response.status, 200, JSON.stringify(payload));
    return payload;
  }));

  const marker = "CI concurrency probe " + Date.now();
  const attempts = await Promise.all(baseUrls.map(async (baseUrl, index) => {
    const response = await fetch(baseUrl + "/api/trips", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + logins[index].token,
      },
      body: JSON.stringify({
        origin: marker + " origin " + index,
        originCountry: "UG",
        destination: "Nairobi",
        destinationCountry: "KE",
        departureDate: "2026-12-15",
        vehicleType: "Flatbed",
        capacityTons: 10,
        capacityM3: 40,
        price: 100000,
        currency: "UGX",
        priceType: "Fixed",
      }),
    });
    return { status: response.status, body: await response.json() };
  }));

  assert.deepEqual(attempts.map((attempt) => attempt.status).sort(), [201, 409]);
  const conflict = attempts.find((attempt) => attempt.status === 409);
  assert.match(conflict.body.error, /Data changed during this request/);

  const listings = await Promise.all(baseUrls.map(async (baseUrl, index) => {
    const response = await fetch(baseUrl + "/api/trips", {
      headers: { authorization: "Bearer " + logins[index].token },
    });
    assert.equal(response.status, 200);
    return response.json();
  }));
  for (const trips of listings) {
    assert.equal(trips.filter((trip) => trip.origin.startsWith(marker)).length, 1);
  }
});
