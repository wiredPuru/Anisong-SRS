import { describe, expect, it } from "vitest";
import { fuzzyScore, rankCommands } from "./fuzzyMatch";

const commands = [
  { title: "Play / pause", keywords: ["resume", "stop"] },
  { title: "Pixelate", keywords: ["mosaic", "blocks"] },
  { title: "Blur", keywords: ["soften"] },
  { title: "Add songs", keywords: ["add show", "search", "queue a song"] },
  { title: "Queue" },
  { title: "Next song", keywords: ["skip"] },
  { title: "Skip to end" },
];

const titles = (query: string, limit = 12) => rankCommands(query, commands, limit).map((match) => match.item.title);

describe("fuzzyScore", () => {
  it("matches partial, upper-case, and full words", () => {
    expect(fuzzyScore("pixel", "Pixelate")).not.toBeNull();
    expect(fuzzyScore("PIXELATE", "Pixelate")).not.toBeNull();
    expect(fuzzyScore("ate", "Pixelate")).not.toBeNull();
  });

  it("forgives one typo in a word of four or more letters", () => {
    expect(fuzzyScore("pixlate", "Pixelate")).not.toBeNull();
    expect(fuzzyScore("pixle", "Pixelate")).not.toBeNull();
    expect(fuzzyScore("bkur", "Blur")).not.toBeNull();
  });

  it("does not forgive a typo in a short word", () => {
    expect(fuzzyScore("bkr", "Blur")).toBeNull();
  });

  it("needs every query word to match", () => {
    expect(fuzzyScore("pixel blur", "Pixelate")).toBeNull();
  });

  it("matches words in any order", () => {
    expect(fuzzyScore("songs add", "Add songs")).not.toBeNull();
  });

  it("is null for an empty or blank query", () => {
    expect(fuzzyScore("", "Pixelate")).toBeNull();
    expect(fuzzyScore("   ", "Pixelate")).toBeNull();
  });

  it("ranks a title prefix above a keyword prefix above loose word matches", () => {
    const titlePrefix = fuzzyScore("add", "Add songs", ["add show"])!;
    const keywordPrefix = fuzzyScore("add show", "Add songs", ["add show"])!;
    const loose = fuzzyScore("show add", "Add songs", ["add show"])!;
    expect(titlePrefix).toBeGreaterThan(keywordPrefix);
    expect(keywordPrefix).toBeGreaterThan(loose);
  });

  it("ranks an exact word above a typo", () => {
    expect(fuzzyScore("blur", "Blur")!).toBeGreaterThan(fuzzyScore("bkur", "Blur")!);
  });
});

describe("rankCommands", () => {
  it("puts Pixelate first for pix and for a typo", () => {
    expect(titles("pix")[0]).toBe("Pixelate");
    expect(titles("pixlate")[0]).toBe("Pixelate");
  });

  it("reaches Add songs through its keywords", () => {
    expect(titles("add show")[0]).toBe("Add songs");
    expect(titles("queue a")).toEqual(["Add songs"]);
  });

  it("ranks a title match above a keyword match", () => {
    expect(titles("skip")).toEqual(["Skip to end", "Next song"]);
  });

  it("keeps the given order on ties and honours the limit", () => {
    expect(titles("song")).toEqual(["Add songs", "Next song"]);
    expect(titles("song", 1)).toEqual(["Add songs"]);
  });

  it("returns nothing for an empty query", () => {
    expect(rankCommands("", commands, 12)).toEqual([]);
  });
});
