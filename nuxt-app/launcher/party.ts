import { networkInterfaces } from "node:os";
import { DOOR_HOME, type Door, decideDoorRequest, lanAddresses } from "./partyDoors.ts";
import { applyServerEnv, openBrowser, startBuiltServer, waitForServer } from "./serverEnv.ts";

// Party mode (feature 86). Deliberately never sets GAQ_SRS_INSTALL_DIR: only
// the SRS launcher offers self-update or cleans up after one.
applyServerEnv();

const displayPort = Number(process.env.GAQ_PARTY_DISPLAY_PORT || 4000);
const controlPort = Number(process.env.GAQ_PARTY_CONTROL_PORT || 4001);
const internalPort = Number(process.env.GAQ_PARTY_INTERNAL_PORT || 4002);

const displayUrl = `http://127.0.0.1:${displayPort}${DOOR_HOME.display}`;
const localControlUrl = `http://127.0.0.1:${controlPort}${DOOR_HOME.control}`;
const lanControlUrls = lanAddresses(networkInterfaces()).map((ip) => `http://${ip}:${controlPort}${DOOR_HOME.control}`);

process.env.GAQ_PARTY = "1";
process.env.GAQ_PARTY_DISPLAY_URL = displayUrl;
process.env.GAQ_PARTY_CONTROL_URLS = [localControlUrl, ...lanControlUrls].join(",");

// The app behind the doors is the whole unauthenticated SRS, so it stays on
// loopback; only the control door below faces the LAN.
process.env.PORT = String(internalPort);
process.env.NITRO_PORT = String(internalPort);
process.env.NITRO_HOST = "127.0.0.1";
process.env.HOST = "127.0.0.1";
const internalOrigin = `http://127.0.0.1:${internalPort}`;

await startBuiltServer();
if (!(await waitForServer(`${internalOrigin}/`))) {
  console.error(`The party server did not start on ${internalOrigin} in time.`);
  process.exit(1);
}

function serveDoor(door: Door, hostname: string, port: number) {
  try {
    return Bun.serve({
      hostname,
      port,
      // Server-sent event streams sit quiet between the app's 5s heartbeats.
      idleTimeout: 30,
      // Never Bun's development error page, which would show a stack trace
      // on the projector.
      development: false,
      async fetch(request, server) {
        const url = new URL(request.url);
        const decision = decideDoorRequest(door, url.pathname);
        if (decision.kind === "notFound") return new Response("Not Found", { status: 404 });
        if (decision.kind === "redirect") return Response.redirect(decision.location, 302);

        // Overwritten, never passed through: the app trusts these two headers
        // to know which door a request used and who sent it.
        const headers = new Headers(request.headers);
        headers.delete("host");
        headers.set("x-gaq-party-door", door);
        headers.set("x-gaq-party-client-ip", server.requestIP(request)?.address ?? "");

        const hasBody = request.method !== "GET" && request.method !== "HEAD";
        try {
          return await fetch(`${internalOrigin}${url.pathname}${url.search}`, {
            method: request.method,
            headers,
            body: hasBody ? request.body : undefined,
            redirect: "manual",
            // Pass compressed bodies through as-is so Content-Encoding and
            // Content-Length stay true for the browser.
            decompress: false,
          });
        } catch {
          return new Response("The party server is not responding.", { status: 502 });
        }
      },
    });
  } catch (err) {
    console.error(`Could not open the ${door} port ${port}. Is another copy of GAQ Party running?`);
    console.error(err);
    process.exit(1);
  }
}

serveDoor("display", "127.0.0.1", displayPort);
serveDoor("control", "0.0.0.0", controlPort);

// Nitro closes its own server on these signals but not the doors, which
// would keep the process alive holding both ports with nothing behind them.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => process.exit(0));
}

console.log("GAQ Party is running.");
console.log(`  Display (this machine only): ${displayUrl}`);
console.log(`  Host panel:                  ${localControlUrl}`);
for (const lanUrl of lanControlUrls) console.log(`  Host panel on your network:  ${lanUrl}`);
if (process.env.GAQ_SRS_SKIP_BROWSER !== "1") openBrowser(localControlUrl);
