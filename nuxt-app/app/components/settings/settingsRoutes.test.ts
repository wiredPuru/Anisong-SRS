import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENTS = "app/components/settings";
const ROUTES = "server/api/media-library";

// A copied control once kept a half-renamed URL and posted to a route that
// does not exist; nothing else would have caught it before a click.
describe("settings controls call routes that exist", () => {
  const calls = readdirSync(COMPONENTS)
    .filter((name) => name.endsWith(".vue"))
    .flatMap((name) => {
      const source = readFileSync(join(COMPONENTS, name), "utf8");
      return [...source.matchAll(/["'`]\/api\/media-library\/([a-z0-9-]+)["'`]/g)].map((match) => ({ name, route: match[1]! }));
    });

  it("finds the controls' calls", () => {
    expect(calls.length).toBeGreaterThan(5);
  });

  it.each(calls.map((call) => [call.name, call.route]))("%s -> /api/media-library/%s", (_name, route) => {
    const hasRoute = [".post.ts", ".get.ts", ".delete.ts", ".patch.ts", ".put.ts"]
      .some((suffix) => existsSync(join(ROUTES, `${route}${suffix}`)));
    expect(hasRoute).toBe(true);
  });
});
