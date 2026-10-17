import { describe, expect, it } from "vitest";
import { answerSearchRoute } from "./answerSearchRoute.ts";

describe("answerSearchRoute", () => {
  it("uses the provider route online", () => {
    expect(answerSearchRoute("anime", false, "/api/lookup/anilist-search", "naruto")).toEqual({
      path: "/api/lookup/anilist-search",
      query: { q: "naruto" },
    });
  });

  it.each([true, null] as const)("uses the library route when the mode is %s", (mode) => {
    expect(answerSearchRoute("song", mode, "/api/lookup/song-answer-search", "a")).toEqual({
      path: "/api/study/answer-local",
      query: { kind: "song", q: "a" },
    });
  });
});
