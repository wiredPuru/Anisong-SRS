import { describe, expect, it } from "vitest";
import type { CardWithDetails } from "./cards.ts";
import {
  applyPartyCommand,
  initialPartyState,
  parsePartyCommand,
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

