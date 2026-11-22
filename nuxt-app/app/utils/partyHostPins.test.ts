import { describe, expect, it } from "vitest";
import { PARTY_PALETTE_COMMANDS, paletteCommandById } from "./partyPalette";
import { commandSection, DEFAULT_PINS, moreOptionsSections, parsePins, PIN_LIMIT, togglePin } from "./partyHostPins";

const ALL_IDS = PARTY_PALETTE_COMMANDS.map((command) => command.id);

describe("moreOptionsSections", () => {
  it("puts every palette command in exactly one section", () => {
    for (const id of ALL_IDS) expect(commandSection(id), id).not.toBeNull();
    const listed = moreOptionsSections().flatMap((section) => section.commands.map((command) => command.id));
    expect(listed.sort()).toEqual([...ALL_IDS].sort());
  });

  it("lists sections in the reference order, none empty", () => {
    const sections = moreOptionsSections();
    expect(sections.map((section) => section.title)).toEqual(["Queue", "Toggles", "Reveal", "Playback and session", "Scoreboard"]);
    for (const section of sections) expect(section.commands.length, section.title).toBeGreaterThan(0);
  });

  it("knows nothing about an unknown id", () => {
    expect(commandSection("nope")).toBeNull();
  });
});

describe("DEFAULT_PINS", () => {
  it("are known commands within the limit", () => {
    for (const id of DEFAULT_PINS) expect(paletteCommandById(id), id).not.toBeNull();
    expect(DEFAULT_PINS.length).toBeLessThanOrEqual(PIN_LIMIT);
  });
});

describe("parsePins", () => {
  it("gives the defaults when nothing is stored or it cannot be read", () => {
    expect(parsePins(null)).toEqual(DEFAULT_PINS);
    expect(parsePins("{not json")).toEqual(DEFAULT_PINS);
    expect(parsePins('{"a":1}')).toEqual(DEFAULT_PINS);
    expect(parsePins('"reveal"')).toEqual(DEFAULT_PINS);
  });

  it("keeps known ids in order and drops unknown ones and repeats", () => {
    expect(parsePins(JSON.stringify(["music", "gone", "reveal", "music", 3]))).toEqual(["music", "reveal"]);
  });

  it("keeps an empty list empty", () => {
    expect(parsePins("[]")).toEqual([]);
  });

  it("stops at the limit", () => {
    expect(parsePins(JSON.stringify(ALL_IDS))).toHaveLength(PIN_LIMIT);
  });
});

describe("togglePin", () => {
  it("adds to the end and removes", () => {
    expect(togglePin(["reveal"], "music")).toEqual(["reveal", "music"]);
    expect(togglePin(["reveal", "music"], "reveal")).toEqual(["music"]);
  });

  it("refuses an unknown id or one past the limit", () => {
    expect(togglePin(["reveal"], "gone")).toEqual(["reveal"]);
    const full = ALL_IDS.slice(0, PIN_LIMIT);
    expect(togglePin(full, ALL_IDS[PIN_LIMIT]!)).toEqual(full);
    expect(togglePin(full, full[0]!)).toHaveLength(PIN_LIMIT - 1);
  });
});
