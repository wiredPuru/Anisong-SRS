import { describe, expect, it } from "vitest";
import { partyCoverPath } from "./partyCoverPath.ts";

describe("partyCoverPath", () => {
  it("routes a cover through the door's own cover route by token", () => {
    expect(partyCoverPath("host", "abc", "/api/anime/cover?id=4&v=4.jpg")).toBe("/api/party/host/cover?t=abc");
    expect(partyCoverPath("display", "abc", "https://img.anili.st/k-on.jpg")).toBe("/api/party/display/cover?t=abc");
  });

  it("encodes the token", () => {
    expect(partyCoverPath("host", "a b&c", "x")).toBe("/api/party/host/cover?t=a%20b%26c");
  });

  it("stays null when the song has no cover", () => {
    expect(partyCoverPath("host", "abc", null)).toBeNull();
  });
});
