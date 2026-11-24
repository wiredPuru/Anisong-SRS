import { describe, expect, it } from "vitest";
import { queueClipStatus } from "./partyClipStatus";

describe("queueClipStatus", () => {
  it("uses the server's status when there is one", () => {
    expect(queueClipStatus({ status: "fetching", origin: "stream" }).key).toBe("fetching");
    expect(queueClipStatus({ status: "failed", origin: "local" }).key).toBe("failed");
  });

  it("treats an unchecked library file as ready and an unchecked stream as waiting", () => {
    expect(queueClipStatus({ status: null, origin: "local" })).toMatchObject({ key: "ready", label: "Downloaded to your library" });
    expect(queueClipStatus({ status: null, origin: "stream" }).key).toBe("waiting");
  });

  it("says where a ready clip lives", () => {
    expect(queueClipStatus({ status: "ready", origin: "stream" }).label).toBe("Downloaded and ready to play");
  });
});
