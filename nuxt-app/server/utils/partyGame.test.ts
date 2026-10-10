import { describe, expect, it } from "vitest";
import type { CardWithDetails } from "./cards.ts";
import {
  NO_EFFECTS,
  DEFAULT_LIGHTNING,
  applyPartyCommand,
  initialPartyState,
  lightningStep,
  listPartyClips,
  nextPartyClip,
  parsePartyCommand,
  parsePartyEffects,
  parsePartyLightning,
  pickPartyClip,
  toDisplayState,
  planJoin,
  planRename,
  toPlayerState,
  buildSummary,
  timerMayReveal,
  toHostState,
  toQueueItem,
  type PartyGameState,
  type PartyPlayer,
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
    suspended: false,
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

describe("nextPartyClip", () => {
  const settings = { clipSource: "both" as const, playbackMode: "auto" as const };
  const both = card({ localVideoPath: null, localAudioPath: null, animethemesVideoUrl: AMQ, animethemesAudioUrl: AMQ_AUDIO });

  it("moves to the next clip in preference order and wraps round", () => {
    const clips = listPartyClips(both, settings);
    expect(clips.map((clip) => clip.kind)).toEqual(["video", "audio"]);
    expect(nextPartyClip(clips, clips[0]!)).toEqual(clips[1]);
    expect(nextPartyClip(clips, clips[1]!)).toEqual(clips[0]);
  });

  it("has nothing to change to when only one clip plays", () => {
    const clips = listPartyClips(card({ animethemesVideoUrl: AMQ, animethemesAudioUrl: null }), settings);
    expect(nextPartyClip(clips, clips[0]!)).toBeNull();
  });
});

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

  it("never picks a remote clip when downloaded-only", () => {
    const local = { ...AUTO, downloadedOnly: true };
    const both = card({ localAudioPath: "/lib/a.mp3", animethemesVideoUrl: AMQ });
    expect(pickPartyClip(both, local)).toEqual({ kind: "audio", source: { type: "local", path: "/lib/a.mp3" } });
    expect(pickPartyClip(card({ animethemesVideoUrl: AMQ, animethemesAudioUrl: AMQ_AUDIO }), local)).toBeNull();
    // A stored path whose file is gone counts as not downloaded.
    expect(pickPartyClip(card({ localVideoPath: "/lib/gone.webm", animethemesVideoUrl: AMQ }), local, () => false)).toBeNull();
    // Audio only on a card with just a local video has nothing downloaded to play.
    expect(pickPartyClip(card({ localVideoPath: "/lib/v.webm", animethemesAudioUrl: AMQ_AUDIO }), { ...local, playbackMode: "audioOnly" })).toBeNull();
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

  it("validates the skip flag on seek", () => {
    expect(parsePartyCommand({ type: "seek", seconds: 12, skip: true })).toEqual({ type: "seek", seconds: 12, skip: true });
    expect(parsePartyCommand({ type: "seek", seconds: 12, skip: false })).toEqual({ type: "seek", seconds: 12 });
    for (const skip of ["yes", 1, null]) {
      expect(parsePartyCommand({ type: "seek", seconds: 12, skip })).toHaveProperty("error");
    }
  });

  it("validates and dedupes load", () => {
    expect(parsePartyCommand({ type: "load", cardIds: [3, 1, 3] })).toEqual({
      type: "load",
      cardIds: [3, 1],
      shuffle: false,
      downloadedOnly: false,
      append: false,
    });
    expect(parsePartyCommand({ type: "load", cardIds: [1], shuffle: true, downloadedOnly: true })).toEqual({
      type: "load",
      cardIds: [1],
      shuffle: true,
      downloadedOnly: true,
      append: false,
    });
    expect(parsePartyCommand({ type: "load", cardIds: [1], downloadedOnly: 1 })).toHaveProperty("error");
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

  it("bumps skipSeq only on a skip seek, and keeps it across End game", () => {
    const plain = applyPartyCommand(loaded(), { type: "seek", seconds: 30 });
    expect(plain.skipSeq).toBe(0);
    const skipped = applyPartyCommand(plain, { type: "seek", seconds: 87, skip: true });
    expect([skipped.seekTo, skipped.seekSeq, skipped.skipSeq]).toEqual([87, 2, 1]);
    const moved = applyPartyCommand(skipped, { type: "next" });
    expect(moved.skipSeq).toBe(1);
    expect(applyPartyCommand(skipped, { type: "clear" }).skipSeq).toBe(1);
    expect(applyPartyCommand(initialPartyState(), { type: "seek", seconds: 5, skip: true }).skipSeq).toBe(0);
  });

  it("keeps a playing game playing across moves and a paused one paused", () => {
    const playing = applyPartyCommand(loaded(3), { type: "play" });
    for (const command of [{ type: "next" }, { type: "jump", index: 2 }] as const) {
      expect(applyPartyCommand(playing, command).playing).toBe(true);
      expect(applyPartyCommand(loaded(3), command).playing).toBe(false);
    }
    const second = applyPartyCommand(playing, { type: "next" });
    expect(applyPartyCommand(second, { type: "previous" }).playing).toBe(true);
    expect(applyPartyCommand(applyPartyCommand(second, { type: "pause" }), { type: "previous" }).playing).toBe(false);
  });

  it("starts a newly loaded or cleared game paused", () => {
    const playing = applyPartyCommand(loaded(2), { type: "play" });
    expect(applyPartyCommand(playing, { type: "load", cardIds: [1] }, { loaded: items(2) }).playing).toBe(false);
    expect(applyPartyCommand(playing, { type: "clear" }).playing).toBe(false);
  });

  it("moves between items, resetting playback, and stops at both ends (Next at the end shows results)", () => {
    let state = applyPartyCommand(loaded(2), { type: "play" });
    state = applyPartyCommand(state, { type: "reveal" });
    state = { ...state, position: { token: "t1", currentTime: 5, duration: 90, playing: true, blocked: false, elapsed: 5 } };
    const second = applyPartyCommand(state, { type: "next" });
    expect(second).toMatchObject({ index: 1, phase: "guessing", playing: true, startAt: 0, seekTo: null, position: null });
    const ended = applyPartyCommand(second, { type: "next" });
    expect(ended).toMatchObject({ index: 1, summaryVisible: true });
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
    expect(display.skipSeq).toBe(0);
    const json = JSON.stringify(display);
    expect(json).not.toContain("animemusicquiz");
    expect(json).not.toContain("K-On");
    expect(json).not.toContain("cardId");
  });

  it("lists the next two tokens to buffer, and nothing else about them", () => {
    const first = toDisplayState(loaded(4));
    expect(first.upcoming).toEqual(["t2", "t3"]);
    const last = toDisplayState(applyPartyCommand(loaded(4), { type: "jump", index: 3 }));
    expect(last.upcoming).toEqual([]);
    expect(toDisplayState(applyPartyCommand(loaded(4), { type: "jump", index: 2 })).upcoming).toEqual(["t4"]);
    expect(toDisplayState(initialPartyState()).upcoming).toEqual([]);
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
    position: { token, currentTime: elapsed, duration: 90, playing, blocked: false, elapsed },
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
    expect(lightningStep(at(running(), 30, false))).toBeNull();
    const active = at(running(), 30);
    const blocked = { ...active, position: { ...active.position!, blocked: true } };
    expect(lightningStep(blocked)).toBeNull();
    expect(toHostState(blocked).position).toEqual(blocked.position);
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
    position: { token: state.queue[state.index]!.token, currentTime: elapsed, duration: 90, playing: true, blocked: false, elapsed },
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
      { id: 1, name: "Akira", score: -1, phone: false, connected: false, teamId: null },
      { id: 2, name: "Bea", score: 3, phone: false, connected: false, teamId: null },
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

describe("phone players (feature 90a)", () => {
  const player = (id: number, name: string, extra: Partial<PartyPlayer> = {}): PartyPlayer => ({
    id, name, score: 0, phone: false, connected: false, teamId: null, ...extra,
  });

  it("plans a join: add, claim a host-added or disconnected player, refuse a connected name", () => {
    const players = [player(1, "Aki"), player(2, "Bea", { phone: true, connected: false }), player(3, "Cid", { phone: true, connected: true })];
    expect(planJoin(players, "Dee")).toEqual({ add: true });
    expect(planJoin(players, "  aki ")).toEqual({ claimId: 1 });
    expect(planJoin(players, "BEA")).toEqual({ claimId: 2 });
    expect(planJoin(players, "cid")).toEqual({ error: "taken" });
  });

  it("refuses blank, too-long, and non-string names, and a full game", () => {
    expect(planJoin([], "   ")).toEqual({ error: "invalid" });
    expect(planJoin([], "x".repeat(25))).toEqual({ error: "invalid" });
    expect(planJoin([], 42)).toEqual({ error: "invalid" });
    const full = Array.from({ length: 20 }, (_, i) => player(i + 1, `P${i + 1}`));
    expect(planJoin(full, "New")).toEqual({ error: "full" });
    expect(planJoin(full, "p3")).toEqual({ claimId: 3 });
  });

  it("plans a rename against every other player's name", () => {
    const players = [player(1, "Aki"), player(2, "Bea")];
    expect(planRename(players, 1, "bea")).toEqual({ error: "taken" });
    expect(planRename(players, 1, "AKI")).toEqual({ name: "AKI" });
    expect(planRename(players, 1, "")).toEqual({ error: "invalid" });
  });

  it("adds or claims through playerJoin and tracks connection for phone players only", () => {
    let state = applyPartyCommand(initialPartyState(), { type: "score", op: "add", name: "Aki" });
    state = applyPartyCommand(state, { type: "score", op: "adjust", id: 1, delta: 2 });
    state = applyPartyCommand(state, { type: "playerJoin", name: "aki", claimId: 1 });
    expect(state.scoreboard.players).toEqual([player(1, "aki", { score: 2, phone: true })]);

    state = applyPartyCommand(state, { type: "playerJoin", name: "Bea", claimId: null });
    expect(state.scoreboard.players[1]).toEqual(player(2, "Bea", { phone: true }));
    expect(state.nextPlayerId).toBe(3);

    const online = applyPartyCommand(state, { type: "playerConnection", id: 2, connected: true });
    expect(online.scoreboard.players[1]?.connected).toBe(true);
    expect(online.version).toBe(state.version + 1);
    expect(applyPartyCommand(online, { type: "playerConnection", id: 2, connected: true })).toBe(online);

    const host = applyPartyCommand(initialPartyState(), { type: "score", op: "add", name: "Host" });
    expect(applyPartyCommand(host, { type: "playerConnection", id: 1, connected: true })).toBe(host);
  });

  it("never parses a phone command from the host route", () => {
    expect(parsePartyCommand({ type: "playerJoin", name: "Eve", claimId: null })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "playerConnection", id: 1, connected: true })).toHaveProperty("error");
  });

  it("shows join info on the idle screen always and in a game only while the chip is on", () => {
    const join = { code: "ABCD", urls: ["http://192.168.1.2:4003"] };
    expect(toDisplayState(initialPartyState(), join).join).toEqual(join);
    expect(toDisplayState(loaded(), join).join).toEqual(join);
    const hidden = applyPartyCommand(loaded(), { type: "joinInfo", visible: false });
    expect(toDisplayState(hidden, join).join).toBeNull();
    expect(toDisplayState(applyPartyCommand(hidden, { type: "clear" }), join).join).toEqual(join);
    expect(applyPartyCommand(hidden, { type: "clear" }).joinInfoVisible).toBe(false);
    expect(parsePartyCommand({ type: "joinInfo", visible: "no" })).toHaveProperty("error");
  });

  it("gives a phone its own view with no token or card id, and no answer before the reveal", () => {
    const guessing = applyPartyCommand(loaded(2), { type: "playerJoin", name: "Aki", claimId: null });
    const item = guessing.queue[0]!;
    const before = JSON.stringify(toPlayerState(guessing, 1));
    expect(before).not.toContain(item.answer.animeTitleEnglish);
    expect(before).not.toContain(item.answer.songTitle);
    expect(toPlayerState(guessing, 1).answer).toBeNull();

    const state = applyPartyCommand(guessing, { type: "reveal" });
    const view = toPlayerState(state, 1);
    expect(view).toMatchObject({ me: { id: 1, name: "Aki", score: 0 }, phase: "revealed", song: { number: 1, total: 2 } });
    expect(view.answer).toEqual({ anime: item.answer.animeTitleEnglish, song: item.answer.songTitle, artist: item.answer.artistName });
    const json = JSON.stringify(view);
    expect(json).not.toContain(item.token);
    expect(json).not.toContain("cardId");
    expect(toPlayerState(state, 99).me).toBeNull();
  });
});

describe("buzzer rounds (feature 90b)", () => {
  function withPlayers(state: PartyGameState, names: string[]) {
    return names.reduce((acc, name) => applyPartyCommand(acc, { type: "playerJoin", name, claimId: null }), state);
  }
  function ready() {
    let state = withPlayers(loaded(3), ["Aki", "Bea"]);
    state = applyPartyCommand(state, { type: "buzzer", enabled: true });
    return applyPartyCommand(state, { type: "play" });
  }

  it("refuses buzzes while multiple choice is on", () => {
    const state = applyPartyCommand(ready(), { type: "choices", enabled: true }, { choices: ["A", "B"] });
    expect(toPlayerState(state, 1).buzzer.canBuzz).toBe(false);
    expect(applyPartyCommand(state, { type: "buzz", playerId: 1 })).toBe(state);
  });

  it("accepts the first buzz, pauses, and refuses a second while answering", () => {
    const buzzed = applyPartyCommand(ready(), { type: "buzz", playerId: 1 });
    expect(buzzed).toMatchObject({ playing: false, buzz: { playerId: 1, lockedOut: [], winnerId: null } });
    expect(applyPartyCommand(buzzed, { type: "buzz", playerId: 2 })).toBe(buzzed);
    expect(toDisplayState(buzzed).buzz).toEqual({ answering: "Aki" });
    expect(toPlayerState(buzzed, 1).buzzer).toMatchObject({ answeringIsMe: true, canBuzz: false });
    expect(toPlayerState(buzzed, 2).buzzer).toMatchObject({ answering: "Aki", answeringIsMe: false, canBuzz: false });
  });

  it("refuses a buzz with the buzzer off, after the reveal, or from an unknown player", () => {
    const off = applyPartyCommand(ready(), { type: "buzzer", enabled: false });
    expect(applyPartyCommand(off, { type: "buzz", playerId: 1 })).toBe(off);
    const revealed = applyPartyCommand(ready(), { type: "reveal" });
    expect(applyPartyCommand(revealed, { type: "buzz", playerId: 1 })).toBe(revealed);
    const on = ready();
    expect(applyPartyCommand(on, { type: "buzz", playerId: 42 })).toBe(on);
    const idle = applyPartyCommand(withPlayers(initialPartyState(), ["Aki"]), { type: "buzzer", enabled: true });
    expect(applyPartyCommand(idle, { type: "buzz", playerId: 1 })).toBe(idle);
  });

  it("Correct scores, records the winner, reveals, and resumes", () => {
    let state = applyPartyCommand(ready(), { type: "buzz", playerId: 2 });
    state = applyPartyCommand(state, { type: "buzzJudge", correct: true });
    expect(state).toMatchObject({ phase: "revealed", playing: true, buzz: { playerId: null, winnerId: 2 } });
    expect(state.scoreboard.players.find((p) => p.id === 2)?.score).toBe(1);
    expect(toDisplayState(state).buzz).toEqual({ answering: null });
    expect(toDisplayState(state).roundPoints).toEqual([{ id: 2, name: "Bea", points: 1 }]);
    expect(toPlayerState(state, 1).buzzer.winner).toBe("Bea");
  });

  it("Wrong locks the player out, resumes, and lets another player buzz", () => {
    let state = applyPartyCommand(ready(), { type: "buzz", playerId: 1 });
    state = applyPartyCommand(state, { type: "buzzJudge", correct: false });
    expect(state).toMatchObject({ phase: "guessing", playing: true, buzz: { playerId: null, lockedOut: [1] } });
    expect(state.scoreboard.players.every((p) => p.score === 0)).toBe(true);
    expect(applyPartyCommand(state, { type: "buzz", playerId: 1 })).toBe(state);
    expect(toPlayerState(state, 1).buzzer).toMatchObject({ lockedOut: true, canBuzz: false });
    expect(applyPartyCommand(state, { type: "buzz", playerId: 2 }).buzz.playerId).toBe(2);
  });

  it("holds an auto-reveal timer while someone answers and reveals on a later Wrong", () => {
    let state = applyPartyCommand(ready(), { type: "timer", seconds: 10, autoReveal: true }, { now: () => 1_000 });
    state = applyPartyCommand(state, { type: "buzz", playerId: 1 });
    expect(timerMayReveal(state)).toBe(false);
    const late = applyPartyCommand(state, { type: "buzzJudge", correct: false }, { now: () => 20_000 });
    expect(late).toMatchObject({ phase: "revealed", buzz: { lockedOut: [1] } });
    const early = applyPartyCommand(state, { type: "buzzJudge", correct: false }, { now: () => 5_000 });
    expect(early.phase).toBe("guessing");
    expect(timerMayReveal(early)).toBe(true);
  });

  it("clears the buzz on a move and on End game, and keeps the buzzer setting", () => {
    let state = applyPartyCommand(ready(), { type: "buzz", playerId: 1 });
    state = applyPartyCommand(state, { type: "buzzJudge", correct: false });
    const moved = applyPartyCommand(state, { type: "next" });
    expect(moved.buzz).toEqual({ playerId: null, lockedOut: [], winnerId: null });
    const cleared = applyPartyCommand(state, { type: "clear" });
    expect(cleared.buzz).toEqual({ playerId: null, lockedOut: [], winnerId: null });
    expect(cleared.buzzerEnabled).toBe(true);
  });

  it("drops a buzz whose player is removed and leaves playback paused", () => {
    let state = applyPartyCommand(ready(), { type: "buzz", playerId: 1 });
    state = applyPartyCommand(state, { type: "score", op: "remove", id: 1 });
    expect(state).toMatchObject({ playing: false, buzz: { playerId: null } });
    expect(applyPartyCommand(state, { type: "buzzJudge", correct: true })).toBe(state);
  });

  it("never parses a buzz from the host route, but parses the host's own buzzer commands", () => {
    expect(parsePartyCommand({ type: "buzz", playerId: 1 })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "buzzer", enabled: true })).toEqual({ type: "buzzer", enabled: true });
    expect(parsePartyCommand({ type: "buzzJudge", correct: "yes" })).toHaveProperty("error");
  });
});

describe("per-song awards (feature 90c)", () => {
  function game() {
    let state = ["Aki", "Bea"].reduce(
      (acc, name) => applyPartyCommand(acc, { type: "playerJoin", name, claimId: null }),
      loaded(3),
    );
    state = applyPartyCommand(state, { type: "reveal" });
    return state;
  }
  const score = (state: PartyGameState, id: number) => state.scoreboard.players.find((p) => p.id === id)?.score;

  it("awards and takes back one point per player per song", () => {
    let state = applyPartyCommand(game(), { type: "award", playerId: 2, awarded: true });
    expect(score(state, 2)).toBe(1);
    expect(toHostState(state).currentAwards).toEqual([2]);
    expect(applyPartyCommand(state, { type: "award", playerId: 2, awarded: true })).toBe(state);
    state = applyPartyCommand(state, { type: "award", playerId: 2, awarded: false });
    expect(score(state, 2)).toBe(0);
    expect(toHostState(state).currentAwards).toEqual([]);
    expect(applyPartyCommand(state, { type: "award", playerId: 2, awarded: false })).toBe(state);
  });

  it("refuses an unknown player or no current song", () => {
    const state = game();
    expect(applyPartyCommand(state, { type: "award", playerId: 9, awarded: true })).toBe(state);
    const idle = applyPartyCommand(initialPartyState(), { type: "playerJoin", name: "Aki", claimId: null });
    expect(applyPartyCommand(idle, { type: "award", playerId: 1, awarded: true })).toBe(idle);
    expect(parsePartyCommand({ type: "award", playerId: 1, awarded: "yes" })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "award", playerId: 0, awarded: true })).toHaveProperty("error");
  });

  it("records a buzz Correct, and un-awarding that winner clears the winner", () => {
    let state = ["Aki"].reduce((acc, name) => applyPartyCommand(acc, { type: "playerJoin", name, claimId: null }), loaded(2));
    state = applyPartyCommand(state, { type: "buzzer", enabled: true });
    state = applyPartyCommand(state, { type: "buzz", playerId: 1 });
    state = applyPartyCommand(state, { type: "buzzJudge", correct: true });
    expect(toHostState(state).currentAwards).toEqual([1]);
    state = applyPartyCommand(state, { type: "award", playerId: 1, awarded: false });
    expect(state.buzz.winnerId).toBeNull();
    expect(score(state, 1)).toBe(0);
  });

  it("keeps awards across moves and resets them on a new load and on End game", () => {
    let state = applyPartyCommand(game(), { type: "award", playerId: 1, awarded: true });
    state = applyPartyCommand(state, { type: "next" });
    expect(toHostState(state).currentAwards).toEqual([]);
    state = applyPartyCommand(state, { type: "previous" });
    expect(toHostState(state).currentAwards).toEqual([1]);
    const reloaded = applyPartyCommand(state, { type: "load", cardIds: [1] }, { loaded: items(2) });
    expect(reloaded.awards).toEqual({});
    expect(applyPartyCommand(state, { type: "clear" }).awards).toEqual({});
  });
});

describe("queue editing (feature 90c)", () => {
  const tokens = (state: PartyGameState) => state.queue.map((item) => item.token);
  function playing(count = 5) {
    let state = applyPartyCommand(loaded(count), { type: "jump", index: 1 });
    state = applyPartyCommand(state, { type: "play" });
    return state;
  }

  it("removes and moves only songs still to come", () => {
    const state = playing();
    expect(tokens(applyPartyCommand(state, { type: "queueRemove", index: 3 }))).toEqual(["t1", "t2", "t3", "t5"]);
    expect(applyPartyCommand(state, { type: "queueRemove", index: 1 })).toBe(state);
    expect(applyPartyCommand(state, { type: "queueRemove", index: 0 })).toBe(state);
    expect(applyPartyCommand(state, { type: "queueRemove", index: 9 })).toBe(state);

    const moved = applyPartyCommand(state, { type: "queueMove", from: 4, to: 2 });
    expect(tokens(moved)).toEqual(["t1", "t2", "t5", "t3", "t4"]);
    expect(moved).toMatchObject({ index: 1, playing: true, phase: "guessing" });
    expect(applyPartyCommand(state, { type: "queueMove", from: 4, to: 1 })).toBe(state);
    expect(applyPartyCommand(state, { type: "queueMove", from: 2, to: 5 })).toBe(state);
    expect(applyPartyCommand(state, { type: "queueMove", from: 3, to: 3 })).toBe(state);
  });

  it("drops a removed song's awards", () => {
    let state = applyPartyCommand(playing(), { type: "playerJoin", name: "Aki", claimId: null });
    state = applyPartyCommand(state, { type: "jump", index: 3 });
    state = applyPartyCommand(state, { type: "award", playerId: 1, awarded: true });
    state = applyPartyCommand(state, { type: "jump", index: 1 });
    expect(Object.keys(applyPartyCommand(state, { type: "queueRemove", index: 3 }).awards)).toEqual([]);
  });

  it("appends new songs without moving the current one, skipping ones already queued", () => {
    const state = playing(3);
    const extra = [
      toQueueItem(card({ id: 2 }), { kind: "video", source: { type: "remote", url: AMQ } }, "dup"),
      toQueueItem(card({ id: 7 }), { kind: "video", source: { type: "remote", url: AMQ } }, "t7"),
    ];
    const appended = applyPartyCommand(state, { type: "load", cardIds: [2, 7], append: true }, { loaded: extra });
    expect(tokens(appended)).toEqual(["t1", "t2", "t3", "t7"]);
    expect(appended).toMatchObject({ index: 1, playing: true, phase: "guessing" });
    const onlyDup = applyPartyCommand(state, { type: "load", cardIds: [2], append: true }, { loaded: [extra[0]!] });
    expect(onlyDup).toBe(state);
  });

  it("starts a fresh game when appending with nothing loaded", () => {
    const fresh = applyPartyCommand(initialPartyState(), { type: "load", cardIds: [1], append: true }, { loaded: items(2) });
    expect(fresh).toMatchObject({ index: 0, playing: false });
  });

  it("parses the queue commands and rejects bad indexes", () => {
    expect(parsePartyCommand({ type: "queueRemove", index: 2 })).toEqual({ type: "queueRemove", index: 2 });
    expect(parsePartyCommand({ type: "queueRemove", index: -1 })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "queueMove", from: 1, to: "2" })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "load", cardIds: [1], append: "yes" })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "load", cardIds: [1], append: true })).toMatchObject({ append: true });
  });
});

describe("round summary (feature 90d)", () => {
  function played() {
    let state = ["Aki", "Bea", "Cid"].reduce(
      (acc, name) => applyPartyCommand(acc, { type: "playerJoin", name, claimId: null }),
      loaded(3),
    );
    state = applyPartyCommand(state, { type: "reveal" });
    state = applyPartyCommand(state, { type: "award", playerId: 2, awarded: true });
    state = applyPartyCommand(state, { type: "award", playerId: 3, awarded: true });
    state = applyPartyCommand(state, { type: "next" });
    return state;
  }

  it("shows and hides on command, and a move hides it", () => {
    const shown = applyPartyCommand(played(), { type: "summary", visible: true });
    expect(toDisplayState(shown).summary).not.toBeNull();
    expect(toHostState(shown).summaryVisible).toBe(true);
    expect(toDisplayState(applyPartyCommand(shown, { type: "summary", visible: false })).summary).toBeNull();
    expect(applyPartyCommand(shown, { type: "next" }).summaryVisible).toBe(false);
    expect(applyPartyCommand(shown, { type: "clear" }).summaryVisible).toBe(false);
    expect(toDisplayState(played()).summary).toBeNull();
  });

  it("shows on Next from the last song", () => {
    let state = applyPartyCommand(played(), { type: "jump", index: 2 });
    state = applyPartyCommand(state, { type: "next" });
    expect(state).toMatchObject({ index: 2, summaryVisible: true });
    expect(applyPartyCommand(state, { type: "next" })).toBe(state);
  });

  it("ranks ties together and lists only songs behind the game", () => {
    const state = played();
    const summary = buildSummary(state);
    expect(summary.standings).toEqual([
      { rank: 1, name: "Bea", score: 1 },
      { rank: 1, name: "Cid", score: 1 },
      { rank: 3, name: "Aki", score: 0 },
    ]);
    expect(summary).toMatchObject({ played: 1, total: 3 });
    expect(summary.songs).toEqual([{ number: 1, anime: state.queue[0]!.answer.animeTitleEnglish, song: state.queue[0]!.answer.songTitle, scorers: ["Bea", "Cid"] }]);
    const revealed = applyPartyCommand(state, { type: "reveal" });
    expect(buildSummary(revealed).songs).toHaveLength(2);
  });

  it("drops a removed player from a song's scorers", () => {
    const state = applyPartyCommand(played(), { type: "score", op: "remove", id: 3 });
    expect(buildSummary(state).songs[0]!.scorers).toEqual(["Bea"]);
  });

  it("parses the summary command", () => {
    expect(parsePartyCommand({ type: "summary", visible: true })).toEqual({ type: "summary", visible: true });
    expect(parsePartyCommand({ type: "summary", visible: 1 })).toHaveProperty("error");
  });
});

describe("round points (feature 91a)", () => {
  function game(count = 3) {
    return ["Aki", "Bea"].reduce(
      (acc, name) => applyPartyCommand(acc, { type: "playerJoin", name, claimId: null }),
      loaded(count),
    );
  }
  const plus = (state: PartyGameState, id: number, delta = 1) =>
    applyPartyCommand(state, { type: "score", op: "adjust", id, delta });
  const round = (state: PartyGameState) => toDisplayState(state).roundPoints;

  it("adds quick +1s into one tally, ranked by points", () => {
    let state = game();
    for (let i = 0; i < 4; i++) state = plus(state, 1);
    state = plus(state, 2);
    expect(round(state)).toEqual([
      { id: 1, name: "Aki", points: 4 },
      { id: 2, name: "Bea", points: 1 },
    ]);
  });

  it("drops a player whose net comes back to zero, and keeps a negative net", () => {
    let state = applyPartyCommand(applyPartyCommand(game(), { type: "reveal" }), { type: "award", playerId: 2, awarded: true });
    expect(round(state)).toEqual([{ id: 2, name: "Bea", points: 1 }]);
    state = applyPartyCommand(state, { type: "award", playerId: 2, awarded: false });
    expect(round(state)).toEqual([]);
    expect(round(plus(state, 1, -1))).toEqual([{ id: 1, name: "Aki", points: -1 }]);
  });

  it("starts empty on every song move, a new load, and End game", () => {
    const scored = plus(game(), 1);
    for (const command of [
      { type: "next" },
      { type: "jump", index: 2 },
      { type: "clear" },
    ] as const) {
      expect(round(applyPartyCommand(scored, command))).toEqual([]);
    }
    const second = plus(applyPartyCommand(game(), { type: "next" }), 1);
    expect(round(applyPartyCommand(second, { type: "previous" }))).toEqual([]);
    const reloaded = applyPartyCommand(scored, { type: "load", cardIds: [1] }, { loaded: items(2) });
    expect(round(reloaded)).toEqual([]);
    const appended = applyPartyCommand(scored, { type: "load", cardIds: [9], append: true }, { loaded: items(5).slice(3) });
    expect(round(appended)).toEqual([{ id: 1, name: "Aki", points: 1 }]);
  });

  it("counts no round without a song, and Reset scores or removing a player clears theirs", () => {
    const idle = ["Aki"].reduce((acc, name) => applyPartyCommand(acc, { type: "playerJoin", name, claimId: null }), initialPartyState());
    const adjusted = plus(idle, 1);
    expect(adjusted.scoreboard.players[0]!.score).toBe(1);
    expect(adjusted.roundPoints).toEqual({});
    const scored = plus(plus(game(), 1), 2);
    expect(round(applyPartyCommand(scored, { type: "score", op: "reset" }))).toEqual([]);
    expect(round(applyPartyCommand(scored, { type: "score", op: "remove", id: 1 }))).toEqual([{ id: 2, name: "Bea", points: 1 }]);
  });
});
