import { describe, expect, it } from "vitest";
import type { CardWithDetails } from "./cards.ts";
import {
  NO_EFFECTS,
  DEFAULT_LIGHTNING,
  applyPartyCommand,
  initialPartyState,
  lightningStep,
  parsePartyCommand,
  parsePartyEffects,
  parsePartyLightning,
  pickPartyClip,
  toDisplayState,
  toHostState,
  toQueueItem,
  type PartyGameState,
  type PartyQueueItem,
} from "./partyGame.ts";

const AMQ = "https://naedist.animemusicquiz.com/abc.webm";
const AMQ_AUDIO = "https://naedist.animemusicquiz.com/abc.mp3";
const THEMES = "https://v.animethemes.moe/Show-OP1.webm";

function card(overrides: Partial<CardWithDetails> = {}): CardWithDetails {
  return {
    id: 7,
    songId: 70,
    localVideoPath: null,
    localAudioPath: null,
    animethemesVideoUrl: null,
    animethemesAudioUrl: null,
    notes: null,
    box: 1,
    streak: 0,
    nextReviewAt: new Date(0),
    createdAt: new Date(0),
    songTitle: "GO! GO! MANIAC",
    songTitleNative: "GO! GO! MANIAC",
    themeSlot: "OP1",
    artistId: 3,
    artistName: "Ho-Kago Tea Time",
    animeId: 9,
    animeAniListId: 7791,
    animeAnimethemesSlug: null,
    animethemesVideoSlug: null,
    animeTitleEnglish: "K-On! Season 2",
    animeTitleRomaji: "K-On!!",
    animeTitleNative: "けいおん！！",
    animeCoverImageUrl: "https://img.anili.st/k-on.jpg",
    ...overrides,
  };
}

const AUTO = { clipSource: "both" as const, playbackMode: "auto" as const };

describe("pickPartyClip", () => {
  it("prefers local video, then remote video, then local audio, then remote audio", () => {
    const all = card({ localVideoPath: "/lib/v.webm", animethemesVideoUrl: AMQ, localAudioPath: "/lib/a.mp3", animethemesAudioUrl: AMQ_AUDIO });
    expect(pickPartyClip(all, AUTO)).toEqual({ kind: "video", source: { type: "local", path: "/lib/v.webm" } });
    expect(pickPartyClip({ ...all, localVideoPath: null }, AUTO)).toEqual({ kind: "video", source: { type: "remote", url: AMQ } });
    expect(pickPartyClip({ ...all, localVideoPath: null, animethemesVideoUrl: null }, AUTO)).toEqual({
      kind: "audio",
      source: { type: "local", path: "/lib/a.mp3" },
    });
    expect(pickPartyClip(card({ animethemesAudioUrl: AMQ_AUDIO }), AUTO)).toEqual({
      kind: "audio",
      source: { type: "remote", url: AMQ_AUDIO },
    });
  });

  it("never picks video under Audio only", () => {
    const both = card({ localVideoPath: "/lib/v.webm", animethemesAudioUrl: AMQ_AUDIO });
    expect(pickPartyClip(both, { ...AUTO, playbackMode: "audioOnly" })?.kind).toBe("audio");
    expect(pickPartyClip(card({ localVideoPath: "/lib/v.webm" }), { ...AUTO, playbackMode: "audioOnly" })).toBeNull();
  });

  it("skips a remote URL the clip source excludes", () => {
    const themesOnly = card({ animethemesVideoUrl: THEMES, animethemesAudioUrl: AMQ_AUDIO });
    expect(pickPartyClip(themesOnly, { ...AUTO, clipSource: "anisongdb" })).toEqual({
      kind: "audio",
      source: { type: "remote", url: AMQ_AUDIO },
    });
    expect(pickPartyClip(card({ animethemesVideoUrl: THEMES }), { ...AUTO, clipSource: "anisongdb" })).toBeNull();
  });

  it("passes over a local file that is not usable", () => {
    const stale = card({ localVideoPath: "/lib/gone.webm", animethemesVideoUrl: AMQ, localAudioPath: "/lib/gone.mp3" });
    const usable = (path: string) => !path.includes("gone");
    expect(pickPartyClip(stale, AUTO, usable)).toEqual({ kind: "video", source: { type: "remote", url: AMQ } });
    expect(pickPartyClip(card({ localAudioPath: "/lib/gone.mp3" }), AUTO, usable)).toBeNull();
  });

  it("returns null with no source at all", () => {
    expect(pickPartyClip(card(), AUTO)).toBeNull();
  });
});

describe("parsePartyCommand", () => {
  it("accepts the argument-free commands", () => {
    for (const type of ["play", "pause", "next", "previous", "reveal", "clear"]) {
      expect(parsePartyCommand({ type })).toEqual({ type });
    }
  });

  it("validates seek", () => {
    expect(parsePartyCommand({ type: "seek", seconds: 12.5 })).toEqual({ type: "seek", seconds: 12.5 });
    for (const seconds of [-1, "3", Number.NaN, Infinity, undefined]) {
      expect(parsePartyCommand({ type: "seek", seconds })).toHaveProperty("error");
    }
  });

  it("validates and dedupes load", () => {
    expect(parsePartyCommand({ type: "load", cardIds: [3, 1, 3] })).toEqual({ type: "load", cardIds: [3, 1], shuffle: false });
    expect(parsePartyCommand({ type: "load", cardIds: [1], shuffle: true })).toEqual({ type: "load", cardIds: [1], shuffle: true });
    expect(parsePartyCommand({ type: "load", cardIds: [] })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "load", cardIds: [1.5] })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "load", cardIds: [0] })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "load", cardIds: Array.from({ length: 2001 }, (_, i) => i + 1) })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "load", cardIds: [1], shuffle: "yes" })).toHaveProperty("error");
  });

  it("rejects unknown and malformed commands", () => {
    expect(parsePartyCommand({ type: "explode" })).toHaveProperty("error");
    expect(parsePartyCommand(null)).toHaveProperty("error");
    expect(parsePartyCommand("play")).toHaveProperty("error");
  });
});

function items(count: number): PartyQueueItem[] {
  return Array.from({ length: count }, (_, i) =>
    toQueueItem(card({ id: i + 1 }), { kind: "video", source: { type: "remote", url: AMQ } }, `t${i + 1}`),
  );
}

function loaded(count = 3): PartyGameState {
  return applyPartyCommand(initialPartyState(), { type: "load", cardIds: [1] }, { loaded: items(count) });
}

describe("applyPartyCommand", () => {
  it("loads a queue at the first item, paused and guessing", () => {
    const state = loaded();
    expect(state).toMatchObject({ version: 1, index: 0, phase: "guessing", playing: false });
    expect(state.queue.map((item) => item.token)).toEqual(["t1", "t2", "t3"]);
  });

  it("shuffles with the injected random source", () => {
    const state = applyPartyCommand(initialPartyState(), { type: "load", cardIds: [1], shuffle: true }, {
      loaded: items(3),
      random: () => 0,
    });
    expect(state.queue.map((item) => item.token)).toEqual(["t2", "t3", "t1"]);
  });

  it("ignores a load that resolved no playable cards", () => {
    const start = initialPartyState();
    expect(applyPartyCommand(start, { type: "load", cardIds: [1] }, { loaded: [] })).toBe(start);
  });

  it("plays and pauses, no-op when already in that state", () => {
    const playing = applyPartyCommand(loaded(), { type: "play" });
    expect(playing).toMatchObject({ playing: true, version: 2 });
    expect(applyPartyCommand(playing, { type: "play" })).toBe(playing);
    expect(applyPartyCommand(playing, { type: "pause" })).toMatchObject({ playing: false, version: 3 });
  });

  it("bumps seekSeq on every seek, even to the same second", () => {
    const once = applyPartyCommand(loaded(), { type: "seek", seconds: 30 });
    const twice = applyPartyCommand(once, { type: "seek", seconds: 30 });
    expect([once.seekTo, once.seekSeq, twice.seekSeq]).toEqual([30, 1, 2]);
  });

  it("moves between items, resetting playback, and stops at both ends", () => {
    let state = applyPartyCommand(loaded(2), { type: "play" });
    state = applyPartyCommand(state, { type: "reveal" });
    state = { ...state, position: { token: "t1", currentTime: 5, duration: 90, playing: true } };
    const second = applyPartyCommand(state, { type: "next" });
    expect(second).toMatchObject({ index: 1, phase: "guessing", playing: false, startAt: 0, seekTo: null, position: null });
    expect(applyPartyCommand(second, { type: "next" })).toBe(second);
    const first = applyPartyCommand(second, { type: "previous" });
    expect(first.index).toBe(0);
    expect(applyPartyCommand(first, { type: "previous" })).toBe(first);
  });

  it("reveals once", () => {
    const revealed = applyPartyCommand(loaded(), { type: "reveal" });
    expect(revealed.phase).toBe("revealed");
    expect(applyPartyCommand(revealed, { type: "reveal" })).toBe(revealed);
  });

  it("clears back to the initial state while keeping the version moving", () => {
    const cleared = applyPartyCommand(loaded(), { type: "clear" });
    expect(cleared).toEqual({ ...initialPartyState(), version: 2 });
  });

  it("does nothing without a game", () => {
    const empty = initialPartyState();
    for (const command of [{ type: "play" }, { type: "seek", seconds: 1 }, { type: "next" }, { type: "reveal" }, { type: "clear" }] as const) {
      expect(applyPartyCommand(empty, command)).toBe(empty);
    }
  });
});

describe("toDisplayState", () => {
  it("carries no answer, path, URL, or card id before reveal", () => {
    const display = toDisplayState(loaded());
    expect(display.answer).toBeNull();
    expect(display.item).toEqual({ token: "t1", kind: "video", number: 1, total: 3 });
    const json = JSON.stringify(display);
    expect(json).not.toContain("animemusicquiz");
    expect(json).not.toContain("K-On");
    expect(json).not.toContain("cardId");
  });

  it("carries the answer once revealed", () => {
    const display = toDisplayState(applyPartyCommand(loaded(), { type: "reveal" }));
    expect(display.answer?.animeTitleRomaji).toBe("K-On!!");
    expect(JSON.stringify(display)).not.toContain("animemusicquiz");
  });

  it("shows no item with no game", () => {
    expect(toDisplayState(initialPartyState())).toMatchObject({ phase: "idle", item: null, answer: null });
  });
});

describe("toHostState", () => {
  it("lists the whole queue with answers but no clip sources", () => {
    const host = toHostState(loaded(2));
    expect(host.queue).toHaveLength(2);
    expect(host.queue[0]).toMatchObject({ cardId: 1, kind: "video" });
    expect(host.queue[0]!.answer.songTitle).toBe("GO! GO! MANIAC");
    expect(JSON.stringify(host)).not.toContain("animemusicquiz");
  });
});

describe("jump and random start", () => {
  it("parses jump and settings", () => {
    expect(parsePartyCommand({ type: "jump", index: 2 })).toEqual({ type: "jump", index: 2 });
    expect(parsePartyCommand({ type: "jump", index: -1 })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "jump", index: 1.5 })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "settings", randomStart: true })).toEqual({ type: "settings", randomStart: true });
    expect(parsePartyCommand({ type: "settings", randomStart: "on" })).toHaveProperty("error");
  });

  it("jumps within the queue only", () => {
    const state = loaded(3);
    expect(applyPartyCommand(state, { type: "jump", index: 2 }).index).toBe(2);
    expect(applyPartyCommand(state, { type: "jump", index: 3 })).toBe(state);
    expect(applyPartyCommand(state, { type: "jump", index: 0 })).toBe(state);
    const empty = initialPartyState();
    expect(applyPartyCommand(empty, { type: "jump", index: 0 })).toBe(empty);
  });

  it("rolls a start fraction on every move while random start is on", () => {
    const random = () => 0.25;
    let state = applyPartyCommand(initialPartyState(), { type: "settings", randomStart: true });
    expect(state).toMatchObject({ randomStart: true, startFraction: 0, version: 1 });
    state = applyPartyCommand(state, { type: "load", cardIds: [1] }, { loaded: items(3), random });
    expect(state.startFraction).toBe(0.25);
    for (const command of [{ type: "next" }, { type: "previous" }, { type: "jump", index: 2 }] as const) {
      state = applyPartyCommand({ ...state, startFraction: 0 }, command, { random });
      expect(state.startFraction).toBe(0.25);
    }
  });

  it("starts at the beginning while random start is off", () => {
    const state = applyPartyCommand(loaded(3), { type: "next" }, { random: () => 0.9 });
    expect(state.startFraction).toBe(0);
  });

  it("keeps the random start preference through clear", () => {
    const on = applyPartyCommand(loaded(), { type: "settings", randomStart: true });
    expect(applyPartyCommand(on, { type: "clear" }).randomStart).toBe(true);
    expect(applyPartyCommand(on, { type: "settings", randomStart: true })).toBe(on);
  });

  it("carries the fraction to the display and the setting to the host", () => {
    const state = { ...loaded(), randomStart: true, startFraction: 0.4 };
    expect(toDisplayState(state).startFraction).toBe(0.4);
    expect(toHostState(state).randomStart).toBe(true);
  });
});


describe("effects", () => {
  const blur = { blur: 12, pixelate: 0, decay: false, decaySeconds: 20, muted: false, picture: "video" as const };

  it("parses and clamps effects", () => {
    expect(parsePartyEffects({ ...blur, blur: 99, pixelate: 2, decaySeconds: 500 })).toEqual({
      ...blur,
      blur: 40,
      pixelate: 4,
      decaySeconds: 120,
    });
    expect(parsePartyEffects({ ...blur, pixelate: -3, decaySeconds: 1 })).toMatchObject({ pixelate: 0, decaySeconds: 5 });
    expect(parsePartyEffects({ ...blur, picture: "sepia" })).toHaveProperty("error");
    expect(parsePartyEffects({ ...blur, blur: "12" })).toHaveProperty("error");
    expect(parsePartyEffects({ ...blur, muted: 1 })).toHaveProperty("error");
    expect(parsePartyEffects(null)).toHaveProperty("error");
  });

  it("parses the effects command", () => {
    expect(parsePartyCommand({ type: "effects", target: "next", effects: blur })).toEqual({ type: "effects", target: "next", effects: blur });
    expect(parsePartyCommand({ type: "effects", target: "current", effects: null })).toEqual({ type: "effects", target: "current", effects: null });
    expect(parsePartyCommand({ type: "effects", target: "later", effects: blur })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "effects", target: "current", effects: { blur: 1 } })).toHaveProperty("error");
  });

  it("sets the current song's effects, and null resets them", () => {
    const on = applyPartyCommand(loaded(), { type: "effects", target: "current", effects: blur });
    expect(on.effects).toEqual(blur);
    expect(applyPartyCommand(on, { type: "effects", target: "current", effects: null }).effects).toEqual(NO_EFFECTS);
  });

  it("applies an armed preset on every kind of move, once", () => {
    for (const command of [{ type: "next" }, { type: "jump", index: 2 }] as const) {
      const armed = applyPartyCommand(loaded(3), { type: "effects", target: "next", effects: blur });
      expect(armed.effects).toEqual(NO_EFFECTS);
      const moved = applyPartyCommand(armed, command);
      expect(moved.effects).toEqual(blur);
      expect(moved.nextEffects).toBeNull();
    }
    const armedAtTwo = applyPartyCommand(applyPartyCommand(loaded(3), { type: "next" }), { type: "effects", target: "next", effects: blur });
    expect(applyPartyCommand(armedAtTwo, { type: "previous" }).effects).toEqual(blur);
    const armedEmpty = applyPartyCommand(initialPartyState(), { type: "effects", target: "next", effects: blur });
    expect(applyPartyCommand(armedEmpty, { type: "load", cardIds: [1] }, { loaded: items(2) }).effects).toEqual(blur);
  });

  it("cancels an armed preset with null", () => {
    const armed = applyPartyCommand(loaded(), { type: "effects", target: "next", effects: blur });
    expect(applyPartyCommand(armed, { type: "effects", target: "next", effects: null }).nextEffects).toBeNull();
  });

  it("carries the current effects to later songs and through clear", () => {
    const on = applyPartyCommand(loaded(3), { type: "effects", target: "current", effects: blur });
    expect(applyPartyCommand(on, { type: "next" }).effects).toEqual(blur);
    expect(applyPartyCommand(on, { type: "clear" }).effects).toEqual(blur);
  });

  it("sends effects to both views and the armed preset to the host only", () => {
    const armed = applyPartyCommand(
      applyPartyCommand(loaded(), { type: "effects", target: "current", effects: blur }),
      { type: "effects", target: "next", effects: { ...blur, muted: true } },
    );
    expect(toDisplayState(armed).effects).toEqual(blur);
    expect(toDisplayState(armed)).not.toHaveProperty("nextEffects");
    expect(toHostState(armed).nextEffects?.muted).toBe(true);
  });
});

describe("lightning", () => {
  const cfg = { mode: "clues" as const, guessSeconds: 10, revealSeconds: 4 };

  function running(count = 3): PartyGameState {
    let state = applyPartyCommand(loaded(count), { type: "lightning", config: cfg });
    state = applyPartyCommand(state, { type: "play" });
    return state;
  }
  const at = (state: PartyGameState, elapsed: number, playing = true, token = state.queue[state.index]!.token): PartyGameState => ({
    ...state,
    position: { token, currentTime: elapsed, duration: 90, playing, elapsed },
  });

  it("parses and clamps a config", () => {
    expect(parsePartyLightning({ mode: "title", guessSeconds: 2, revealSeconds: 99 })).toEqual({ mode: "title", guessSeconds: 5, revealSeconds: 30 });
    expect(parsePartyLightning({ mode: "emoji", guessSeconds: 10, revealSeconds: 5 })).toHaveProperty("error");
    expect(parsePartyLightning({ mode: "tags", guessSeconds: "10", revealSeconds: 5 })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "lightning", config: null })).toEqual({ type: "lightning", config: null });
    expect(parsePartyCommand({ type: "lightning", config: DEFAULT_LIGHTNING })).toEqual({ type: "lightning", config: DEFAULT_LIGHTNING });
  });

  it("keeps the config through clear, and shows the display its mode", () => {
    const state = running();
    expect(applyPartyCommand(state, { type: "clear" }).lightning).toEqual(cfg);
    expect(toDisplayState(state).lightning).toMatchObject({ mode: "clues", guessSeconds: 10 });
    expect(toHostState(state).lightning).toEqual(cfg);
    expect(applyPartyCommand(state, { type: "lightning", config: null }).lightning).toBeNull();
  });

  it("starts every lightning song at a random point", () => {
    const moved = applyPartyCommand(running(), { type: "next" }, { random: () => 0.6 });
    expect(moved.startFraction).toBe(0.6);
  });

  it("records the play time a reveal happened at", () => {
    const revealed = applyPartyCommand(at(running(), 7), { type: "reveal" });
    expect(revealed.revealedAtElapsed).toBe(7);
    expect(applyPartyCommand(revealed, { type: "next" }).revealedAtElapsed).toBeNull();
  });

  it("reveals once the guess time has played", () => {
    expect(lightningStep(at(running(), 9.5))).toBeNull();
    expect(lightningStep(at(running(), 10))).toBe("reveal");
  });

  it("moves on after the answer has shown for revealSeconds", () => {
    const revealed = applyPartyCommand(at(running(), 10), { type: "reveal" });
    expect(lightningStep(at(revealed, 13.9))).toBeNull();
    expect(lightningStep(at(revealed, 14))).toBe("next");
  });

  it("times an early manual reveal from when it happened", () => {
    const early = applyPartyCommand(at(running(), 3), { type: "reveal" });
    expect(lightningStep(at(early, 6.9))).toBeNull();
    expect(lightningStep(at(early, 7))).toBe("next");
  });

  it("stops at the end of the queue", () => {
    const last = applyPartyCommand(running(2), { type: "next" });
    const playing = applyPartyCommand(last, { type: "play" });
    const revealed = applyPartyCommand(at(playing, 10), { type: "reveal" });
    expect(lightningStep(at(revealed, 20))).toBe("stop");
  });

  it("does nothing when paused, off, or reported for another song", () => {
    expect(lightningStep(at(applyPartyCommand(running(), { type: "pause" }), 30))).toBeNull();
    expect(lightningStep(at(applyPartyCommand(running(), { type: "lightning", config: null }), 30))).toBeNull();
    expect(lightningStep(at(running(), 30, true, "stale"))).toBeNull();
    expect(lightningStep(running())).toBeNull();
  });
});

describe("lightning hints in the display state", () => {
  const details = { year: 2010, season: "SPRING", format: "TV", averageScore: 85, genres: ["Music"], tags: [] };
  function withDetails(mode: "clues" | "title"): PartyGameState {
    const queue = items(2).map((item) => ({ ...item, details }));
    let state = applyPartyCommand(initialPartyState(), { type: "load", cardIds: [1] }, { loaded: queue });
    state = applyPartyCommand(state, { type: "lightning", config: { mode, guessSeconds: 12, revealSeconds: 5 } });
    return state;
  }
  const at = (state: PartyGameState, elapsed: number): PartyGameState => ({
    ...state,
    position: { token: state.queue[state.index]!.token, currentTime: elapsed, duration: 90, playing: true, elapsed },
  });

  it("sends only the clues revealed so far", () => {
    const state = withDetails("clues");
    expect(toDisplayState(state).lightning?.hints).toEqual({ kind: "clues", items: [{ label: "Aired", value: "Spring 2010" }] });
    const json = JSON.stringify(toDisplayState(state));
    expect(json).not.toContain("85%");
    expect(json).not.toContain("Music");
    expect(toDisplayState(at(state, 12)).lightning?.hints).toMatchObject({ items: { length: 4 } });
  });

  it("never sends the unmasked title before the deadline", () => {
    const state = withDetails("title");
    expect(JSON.stringify(toDisplayState(at(state, 11)))).not.toContain("K-On! Season 2");
    expect(toDisplayState(at(state, 0)).lightning?.hints).toEqual({ kind: "title", masked: "_-__! ______ _" });
    const revealed = applyPartyCommand(state, { type: "reveal" });
    expect(toDisplayState(revealed).lightning?.hints).toEqual({ kind: "title", masked: "K-On! Season 2" });
  });
});


describe("timer, scoreboard, banner, and music", () => {
  const now = () => 1_000_000;

  it("starts a timer on a song, ends it on a move, and stops it on request", () => {
    const timed = applyPartyCommand(loaded(2), { type: "timer", seconds: 15, autoReveal: true }, { now });
    expect(timed.timer).toEqual({ seconds: 15, endsAt: 1_015_000, autoReveal: true });
    expect(applyPartyCommand(timed, { type: "next" }).timer).toBeNull();
    expect(applyPartyCommand(timed, { type: "timerStop" }).timer).toBeNull();
    const empty = initialPartyState();
    expect(applyPartyCommand(empty, { type: "timer", seconds: 10, autoReveal: false })).toBe(empty);
  });

  it("validates timer, banner, and music commands", () => {
    expect(parsePartyCommand({ type: "timer", seconds: 2, autoReveal: true })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "timer", seconds: 10.5, autoReveal: true })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "timer", seconds: 10, autoReveal: "yes" })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "banner", text: "  Round 2  " })).toEqual({ type: "banner", text: "Round 2" });
    expect(parsePartyCommand({ type: "banner", text: " " })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "banner", text: "x".repeat(61) })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "music", enabled: true, volume: 3 })).toEqual({ type: "music", enabled: true, volume: 1 });
    expect(parsePartyCommand({ type: "music", enabled: "on", volume: 0.5 })).toHaveProperty("error");
  });

  it("runs a scoreboard", () => {
    let state = applyPartyCommand(loaded(), { type: "score", op: "add", name: "Aki" });
    state = applyPartyCommand(state, { type: "score", op: "add", name: "Bea" });
    const [aki, bea] = state.scoreboard.players;
    expect([aki?.id, bea?.id]).toEqual([1, 2]);
    state = applyPartyCommand(state, { type: "score", op: "adjust", id: 2, delta: 3 });
    state = applyPartyCommand(state, { type: "score", op: "adjust", id: 1, delta: -1 });
    state = applyPartyCommand(state, { type: "score", op: "rename", id: 1, name: "Akira" });
    expect(state.scoreboard.players).toEqual([
      { id: 1, name: "Akira", score: -1 },
      { id: 2, name: "Bea", score: 3 },
    ]);
    const shown = applyPartyCommand(state, { type: "score", op: "show", visible: true });
    expect(toDisplayState(shown).scoreboard?.map((p) => p.name)).toEqual(["Bea", "Akira"]);
    expect(toDisplayState(state).scoreboard).toBeNull();
    const reset = applyPartyCommand(state, { type: "score", op: "reset" });
    expect(reset.scoreboard.players.every((p) => p.score === 0)).toBe(true);
    expect(applyPartyCommand(reset, { type: "score", op: "reset" })).toBe(reset);
    const removed = applyPartyCommand(state, { type: "score", op: "remove", id: 1 });
    expect(removed.scoreboard.players.map((p) => p.id)).toEqual([2]);
    expect(applyPartyCommand(removed, { type: "score", op: "adjust", id: 1, delta: 1 })).toBe(removed);
  });

  it("keeps new player ids unique after a removal and caps the roster", () => {
    let state = applyPartyCommand(loaded(), { type: "score", op: "add", name: "A" });
    state = applyPartyCommand(state, { type: "score", op: "remove", id: 1 });
    state = applyPartyCommand(state, { type: "score", op: "add", name: "B" });
    expect(state.scoreboard.players[0]?.id).toBe(2);
    for (let i = 0; i < 25; i++) state = applyPartyCommand(state, { type: "score", op: "add", name: `P${i}` });
    expect(state.scoreboard.players).toHaveLength(20);
  });

  it("validates score commands", () => {
    expect(parsePartyCommand({ type: "score", op: "add", name: "  Kai  " })).toEqual({ type: "score", op: "add", name: "Kai" });
    expect(parsePartyCommand({ type: "score", op: "add", name: "" })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "score", op: "add", name: "x".repeat(25) })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "score", op: "adjust", id: 1, delta: 0.5 })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "score", op: "remove", id: 0 })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "score", op: "explode" })).toHaveProperty("error");
  });

  it("shows and clears a banner", () => {
    const shown = applyPartyCommand(loaded(), { type: "banner", text: "Round 2" }, { now });
    expect(toDisplayState(shown).banner).toEqual({ text: "Round 2", shownAt: 1_000_000 });
    expect(applyPartyCommand(shown, { type: "banner", text: null }).banner).toBeNull();
  });

  it("keeps the scoreboard and music but drops the banner and timer on clear", () => {
    let state = applyPartyCommand(loaded(), { type: "score", op: "add", name: "Kai" });
    state = applyPartyCommand(state, { type: "music", enabled: true, volume: 0.6 });
    state = applyPartyCommand(state, { type: "banner", text: "Final" }, { now });
    state = applyPartyCommand(state, { type: "timer", seconds: 10, autoReveal: false }, { now });
    const cleared = applyPartyCommand(state, { type: "clear" });
    expect(cleared.scoreboard.players).toHaveLength(1);
    expect(cleared.music).toEqual({ enabled: true, volume: 0.6 });
    expect(cleared.banner).toBeNull();
    expect(cleared.timer).toBeNull();
    expect(applyPartyCommand(cleared, { type: "score", op: "add", name: "Next" }).scoreboard.players[1]?.id).toBe(2);
  });
});
