import { describe, expect, it } from "vitest";
import { parseLastPlayed } from "./lastPlayed";

const valid = {
  cardId: 4,
  songTitle: "Seishun Complex",
  animeTitle: "Bocchi the Rock!",
  image: "data:image/jpeg;base64,AAAA",
  tint: [108, 197, 207],
};

describe("parseLastPlayed", () => {
  it("reads a stored frame", () => {
    expect(parseLastPlayed(JSON.stringify(valid))).toEqual(valid);
  });

  it("accepts a cover URL with no tint", () => {
    const cover = { ...valid, image: "https://s4.anilist.co/cover.jpg", tint: null };
    expect(parseLastPlayed(JSON.stringify(cover))).toEqual(cover);
  });

  it("drops a malformed tint but keeps the rest", () => {
    expect(parseLastPlayed(JSON.stringify({ ...valid, tint: [300, 0, 0] }))?.tint).toBeNull();
    expect(parseLastPlayed(JSON.stringify({ ...valid, tint: "pink" }))?.tint).toBeNull();
  });

  it("refuses missing, broken, or unsafe values", () => {
    expect(parseLastPlayed(null)).toBeNull();
    expect(parseLastPlayed("{not json")).toBeNull();
    expect(parseLastPlayed("[]")).toBeNull();
    expect(parseLastPlayed(JSON.stringify({ ...valid, cardId: "4" }))).toBeNull();
    expect(parseLastPlayed(JSON.stringify({ ...valid, image: "javascript:alert(1)" }))).toBeNull();
    expect(parseLastPlayed(JSON.stringify({ ...valid, image: "http://example.com/a.jpg" }))).toBeNull();
    expect(parseLastPlayed(JSON.stringify({ ...valid, songTitle: undefined }))).toBeNull();
  });
});
