import { PARTY_PALETTE_COMMANDS, paletteCommandById, type PartyPaletteCommand } from "./partyPalette";

export type MoreOptionsSectionId = "queue" | "toggles" | "reveal" | "playback" | "scoreboard";

export const MORE_OPTIONS_SECTIONS: readonly { id: MoreOptionsSectionId; title: string }[] = [
  { id: "queue", title: "Queue" },
  { id: "toggles", title: "Toggles" },
  { id: "reveal", title: "Reveal" },
  { id: "playback", title: "Playback and session" },
  { id: "scoreboard", title: "Scoreboard" },
];

const SECTION_OF: Readonly<Record<string, MoreOptionsSectionId>> = {
  "panel-add-songs": "queue",
  "panel-queue": "queue",
  "panel-new-game": "queue",
  "panel-endless": "queue",
  "panel-lightning": "queue",
  pixelate: "toggles",
  blur: "toggles",
  mute: "toggles",
  picture: "toggles",
  randomStart: "toggles",
  autoAdvance: "toggles",
  buzzer: "toggles",
  music: "toggles",
  ambient: "toggles",
  "panel-effects": "toggles",
  reveal: "reveal",
  summary: "reveal",
  "panel-reveal-fields": "reveal",
  "panel-live": "reveal",
  playPause: "playback",
  next: "playback",
  previous: "playback",
  skip: "playback",
  timer: "playback",
  help: "playback",
  "panel-now-playing": "playback",
  "panel-show": "playback",
  "panel-connect": "playback",
  "panel-themes": "playback",
  scoreboard: "scoreboard",
  joinInfo: "scoreboard",
  "panel-scoreboard": "scoreboard",
  "panel-rules": "scoreboard",
  "panel-join": "scoreboard",
};

export function commandSection(id: string): MoreOptionsSectionId | null {
  return SECTION_OF[id] ?? null;
}

/** Every palette command under its More options section, in palette order. */
export function moreOptionsSections(): { id: MoreOptionsSectionId; title: string; commands: PartyPaletteCommand[] }[] {
  return MORE_OPTIONS_SECTIONS.map((section) => ({
    ...section,
    commands: PARTY_PALETTE_COMMANDS.filter((command) => commandSection(command.id) === section.id),
  }));
}

export const PIN_LIMIT = 12;
export const PINS_STORAGE_KEY = "gaqSrs:partyHostPins";
export const DEFAULT_PINS: readonly string[] = ["reveal", "blur", "pixelate", "picture", "mute", "timer", "scoreboard", "buzzer"];

/** Stored pins, keeping known ids in order without repeats; anything unreadable gives the defaults. */
export function parsePins(raw: string | null): string[] {
  if (raw === null) return [...DEFAULT_PINS];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [...DEFAULT_PINS];
  }
  if (!Array.isArray(parsed)) return [...DEFAULT_PINS];
  const pins: string[] = [];
  for (const id of parsed) {
    if (typeof id === "string" && paletteCommandById(id) && !pins.includes(id)) pins.push(id);
    if (pins.length === PIN_LIMIT) break;
  }
  return pins;
}

/** Pins with `id` added at the end or removed; unchanged when adding would pass the limit. */
export function togglePin(pins: readonly string[], id: string): string[] {
  if (pins.includes(id)) return pins.filter((pin) => pin !== id);
  if (pins.length >= PIN_LIMIT || !paletteCommandById(id)) return [...pins];
  return [...pins, id];
}
