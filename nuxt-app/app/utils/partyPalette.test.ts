import { describe, expect, it } from "vitest";
import { buildHostAction, hostActionById, type HostActionContext } from "./partyHostActions";
import { NEEDS_GAME, PARTY_PALETTE_COMMANDS, paletteCommandById, type PartyPaletteCommand } from "./partyPalette";
import { sampleHostState } from "./testing/partyHostState";

const idle = sampleHostState({ index: -1, queue: [] });
const local = { ambientOn: true };

function command(id: string): PartyPaletteCommand {
  const found = paletteCommandById(id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function context(): HostActionContext {
  return { lastHidingPicture: "bubbles", previewLead: 2 };
}

describe("PARTY_PALETTE_COMMANDS", () => {
  it("has unique ids and unique jump targets", () => {
    const ids = PARTY_PALETTE_COMMANDS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const jumps = PARTY_PALETTE_COMMANDS.filter((entry) => entry.kind === "jump").map((entry) => entry.target);
    expect(new Set(jumps).size).toBe(jumps.length);
  });

  it("gives every jump a target and no run", () => {
    for (const entry of PARTY_PALETTE_COMMANDS.filter((candidate) => candidate.kind === "jump")) {
      expect(entry.target, entry.id).toBeTruthy();
      expect(entry.run, entry.id).toBeUndefined();
    }
  });

  it("gives every toggle a state, and every non-jump a run or a local handler", () => {
    for (const entry of PARTY_PALETTE_COMMANDS.filter((candidate) => candidate.kind !== "jump")) {
      expect(Boolean(entry.run) !== Boolean(entry.local), entry.id).toBe(true);
      if (entry.kind === "toggle") expect(entry.state, entry.id).toBeTypeOf("function");
    }
  });

  it("lists the agreed panels", () => {
    const titles = PARTY_PALETTE_COMMANDS.filter((entry) => entry.group === "Panels").map((entry) => entry.title);
    expect(titles).toEqual([
      "Add songs",
      "Queue",
      "Now playing",
      "Preview and censor",
      "Scoreboard",
      "Rules",
      "Lightning round",
      "Help this song",
      "Effects",
      "Show on reveal",
      "Show (timer, banner, music)",
      "Players join at",
      "Connect a display or phone",
      "New game",
      "Endless playlist",
    ]);
  });

  it("shows hotkeys taken from the host actions", () => {
    expect(command("pixelate").hotkey).toBe("X");
    expect(command("playPause").hotkey).toBe("Space");
    expect(command("help").hotkey).toBe("?");
    expect(command("buzzer").hotkey).toBeUndefined();
  });
});

describe("toggle state", () => {
  it("reads Off from a fresh game", () => {
    for (const id of ["pixelate", "blur", "mute", "picture", "censor", "scoreboard", "buzzer", "joinInfo", "randomStart", "autoAdvance", "summary", "music"]) {
      expect(command(id).state?.(sampleHostState(), local), id).toBe(false);
    }
  });

  it("reads On once each option is set", () => {
    const base = sampleHostState();
    const on = sampleHostState({
      effects: { ...base.effects, pixelate: 24, blur: 14, muted: true, picture: "bubbles" },
      censor: { boxes: [], style: "blur", muted: false },
      scoreboard: { ...base.scoreboard, visible: true },
      buzzerEnabled: true,
      joinInfoVisible: true,
      randomStart: true,
      autoAdvance: true,
      summaryVisible: true,
      music: { enabled: true, volume: 0.5 },
    });
    for (const id of ["pixelate", "blur", "mute", "picture", "censor", "scoreboard", "buzzer", "joinInfo", "randomStart", "autoAdvance", "summary", "music"]) {
      expect(command(id).state?.(on, local), id).toBe(true);
    }
  });

  it("reads the ambient glow from the page, not the party", () => {
    expect(command("ambient").state?.(idle, { ambientOn: false })).toBe(false);
    expect(command("ambient").state?.(idle, { ambientOn: true })).toBe(true);
  });
});

describe("availability", () => {
  it("says Start a game first only without a game", () => {
    for (const entry of PARTY_PALETTE_COMMANDS) {
      expect(entry.available?.(sampleHostState()) ?? null, entry.id).toBeNull();
    }
    expect(command("pixelate").available?.(idle)).toBe(NEEDS_GAME);
    expect(command("panel-queue").available?.(idle)).toBe(NEEDS_GAME);
    expect(command("summary").available?.(idle)).toBe(NEEDS_GAME);
  });

  it("leaves commands that work without a game available", () => {
    for (const id of ["mute", "scoreboard", "buzzer", "joinInfo", "music", "help", "ambient", "panel-add-songs", "panel-new-game"]) {
      expect(command(id).available?.(idle) ?? null, id).toBeNull();
    }
  });
});

describe("run", () => {
  it("sends the same command as the pixelate hotkey", () => {
    const state = sampleHostState();
    expect(command("pixelate").run?.(state, context())).toEqual(buildHostAction(hostActionById("pixelate"), state, context()));
    expect(command("pixelate").run?.(state, context())).toMatchObject({ effects: { pixelate: 24 } });
  });

  it("flips the panel toggles the way their checkboxes do", () => {
    const state = sampleHostState({ music: { enabled: false, volume: 0.3 } });
    expect(command("buzzer").run?.(state, context())).toEqual({ type: "buzzer", enabled: true });
    expect(command("joinInfo").run?.(state, context())).toEqual({ type: "joinInfo", visible: true });
    expect(command("randomStart").run?.(state, context())).toEqual({ type: "settings", randomStart: true });
    expect(command("autoAdvance").run?.(state, context())).toEqual({ type: "autoAdvance", enabled: true });
    expect(command("summary").run?.(state, context())).toEqual({ type: "summary", visible: true });
    expect(command("music").run?.(state, context())).toEqual({ type: "music", enabled: true, volume: 0.3 });
  });
});
