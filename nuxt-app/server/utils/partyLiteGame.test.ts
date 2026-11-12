import { describe, expect, it } from "vitest";
import {
  LITE_UP_NEXT,
  advance,
  fillNeeded,
  goBack,
  heldCardIds,
  initialLiteState,
  insertManual,
  parseLiteCommand,
  parseLitePosition,
  patchSong,
  pickCandidates,
  removeSong,
  toLiteDisplay,
  toLiteHost,
  withoutAutoPicks,
  type LiteSong,
  type LiteState,
} from "./partyLiteGame.ts";

function song(cardId: number, manual = false): LiteSong {
  return {
    token: `t${cardId}`,
    cardId,
    manual,
    clip: { kind: "video", source: { type: "local", path: `/library/secret-${cardId}.webm` } },
    answer: {
      animeTitle: `Anime ${cardId}`,
      animeTitleRomaji: `Romaji ${cardId}`,
      songTitle: `Song ${cardId}`,
      artistName: "Artist",
      themeSlot: "OP1",
      coverImageUrl: "https://example.test/cover.jpg",
    },
    download: "local",
    progress: null,
  };
}

function game(patch: Partial<LiteState> = {}): LiteState {
  return { ...initialLiteState(), ...patch };
}

describe("advance and goBack", () => {
  it("starts the first waiting song and hides the answer again", () => {
    const next = advance(game({ current: song(1), upNext: [song(2), song(3)], revealed: true, played: 1 }));
    expect(next.current?.cardId).toBe(2);
    expect(next.upNext.map((item) => item.cardId)).toEqual([3]);
    expect(next.history.map((item) => item.cardId)).toEqual([1]);
    expect(next).toMatchObject({ revealed: false, playing: true, played: 2, position: null });
  });

  it("goes idle when nothing is waiting", () => {
    const next = advance(game({ current: song(1), playing: true, played: 1 }));
    expect(next).toMatchObject({ current: null, playing: false, played: 1 });
  });

  it("goes back, keeping the interrupted song at the front as a hand pick", () => {
    const next = goBack(game({ current: song(2), upNext: [song(3)], history: [song(1)], played: 2 }));
    expect(next.current?.cardId).toBe(1);
    expect(next.upNext.map((item) => [item.cardId, item.manual])).toEqual([[2, true], [3, false]]);
    expect(next.history).toEqual([]);
    expect(next.played).toBe(1);
  });

  it("restarts the song when there is no history", () => {
    const start = game({ current: song(1), seekSeq: 4 });
    expect(goBack(start)).toMatchObject({ seekTo: 0, seekSeq: 5 });
    expect(goBack(game())).toEqual(game());
  });
});

describe("up next", () => {
  it("keeps hand picks ahead of filter picks", () => {
    let state = game({ upNext: [song(1), song(2)] });
    state = insertManual(state, song(3), "end");
    state = insertManual(state, song(4), "end");
    state = insertManual(state, song(5), "next");
    expect(state.upNext.map((item) => item.cardId)).toEqual([5, 3, 4, 1, 2]);
    expect(withoutAutoPicks(state).upNext.map((item) => item.cardId)).toEqual([5, 3, 4]);
    expect(removeSong(state, "t3").upNext.map((item) => item.cardId)).toEqual([5, 4, 1, 2]);
  });

  it("asks for filter picks only while endless is on", () => {
    expect(fillNeeded(game({ upNext: [song(1)] }))).toBe(LITE_UP_NEXT - 1);
    expect(fillNeeded(game({ upNext: [song(1), song(2), song(3), song(4), song(5)] }))).toBe(0);
    const off = game();
    expect(fillNeeded({ ...off, source: { ...off.source, endless: false } })).toBe(0);
  });

  it("patches a song wherever it sits", () => {
    const state = patchSong(game({ current: song(1), upNext: [song(2)] }), "t2", { download: "downloading", progress: 40 });
    expect(state.upNext[0]).toMatchObject({ download: "downloading", progress: 40 });
    expect(state.current?.download).toBe("local");
  });
});

describe("pickCandidates", () => {
  const first = () => 0;

  it("never picks a held card", () => {
    const held = heldCardIds(game({ current: song(1), upNext: [song(2)] }));
    expect(pickCandidates([1, 2, 3], held, [], 4, first)).toEqual([3]);
  });

  it("prefers cards not played recently, then the oldest played", () => {
    const picks = pickCandidates([1, 2, 3, 4], new Set(), [3, 1], 4, first);
    expect(picks.slice(0, 2).sort()).toEqual([2, 4]);
    expect(picks.slice(2)).toEqual([3, 1]);
  });

  it("returns nothing for an empty pool or a zero count", () => {
    expect(pickCandidates([], new Set(), [], 3)).toEqual([]);
    expect(pickCandidates([1, 2], new Set(), [], 0)).toEqual([]);
  });
});

describe("views", () => {
  it("gives the display no answer, path, or card id before the reveal", () => {
    const view = toLiteDisplay(game({ current: song(7), upNext: [song(8)], playing: true, played: 1 }));
    expect(view).toMatchObject({ phase: "guessing", token: "t7", kind: "video", answer: null });
    const text = JSON.stringify(view);
    for (const secret of ["Anime 7", "Song 7", "secret-7", "Anime 8", "cover.jpg", "cardId"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("gives the display the answer once revealed, still without paths or URLs", () => {
    const view = toLiteDisplay(game({ current: song(7), revealed: true }));
    expect(view.phase).toBe("revealed");
    expect(view.answer).toMatchObject({ animeTitle: "Anime 7", songTitle: "Song 7", hasCover: true });
    expect(JSON.stringify(view)).not.toMatch(/secret-7|cover\.jpg/);
  });

  it("is idle with no song", () => {
    expect(toLiteDisplay(game())).toMatchObject({ phase: "idle", token: null, answer: null });
  });

  it("gives the host answers but never a path", () => {
    const view = toLiteHost(game({ current: song(1), upNext: [song(2)], history: [song(3)] }));
    expect(view.current?.answer.animeTitle).toBe("Anime 1");
    expect(view.canGoBack).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/secret-|cover\.jpg/);
  });
});

describe("parseLiteCommand", () => {
  it("accepts the plain commands", () => {
    for (const type of ["play", "pause", "reveal", "next", "previous", "rerollAll"]) {
      expect(parseLiteCommand({ type })).toEqual({ type });
    }
  });

  it("checks each command's fields", () => {
    expect(parseLiteCommand({ type: "seek", seconds: 12.5 })).toEqual({ type: "seek", seconds: 12.5 });
    expect(parseLiteCommand({ type: "seek", seconds: -1 })).toHaveProperty("error");
    expect(parseLiteCommand({ type: "reroll", token: "abc" })).toEqual({ type: "reroll", token: "abc" });
    expect(parseLiteCommand({ type: "remove" })).toHaveProperty("error");
    expect(parseLiteCommand({ type: "add", cardId: 3, position: "next" })).toEqual({ type: "add", cardId: 3, position: "next" });
    expect(parseLiteCommand({ type: "add", cardId: 0, position: "next" })).toHaveProperty("error");
    expect(parseLiteCommand({ type: "add", cardId: 3, position: "first" })).toHaveProperty("error");
    expect(parseLiteCommand({ type: "endless", enabled: false })).toEqual({ type: "endless", enabled: false });
    expect(parseLiteCommand({ type: "endless" })).toHaveProperty("error");
    expect(parseLiteCommand({ type: "boom" })).toHaveProperty("error");
    expect(parseLiteCommand(null)).toHaveProperty("error");
  });

  it("parses a source with its scope, label, and filters", () => {
    expect(parseLiteCommand({ type: "source", scope: { type: "all" } })).toEqual({
      type: "source",
      scope: { type: "all" },
      label: null,
      filters: null,
    });
    const deck = parseLiteCommand({ type: "source", scope: { type: "created", id: 4 }, label: "  Horror night  " });
    expect(deck).toMatchObject({ scope: { type: "created", id: 4 }, label: "Horror night" });
    expect(parseLiteCommand({ type: "source", scope: { type: "created" } })).toHaveProperty("error");
    expect(parseLiteCommand({ type: "source", scope: { type: "all" }, filters: JSON.stringify({ yearMin: "old" }) })).toHaveProperty("error");
  });
});

describe("parseLitePosition", () => {
  it("accepts a report and rejects malformed ones", () => {
    expect(parseLitePosition({ token: "a", time: 3, duration: 90, ended: true })).toEqual({ token: "a", time: 3, duration: 90, ended: true });
    expect(parseLitePosition({ token: "a", time: 3, duration: null })).toEqual({ token: "a", time: 3, duration: null, ended: false });
    expect(parseLitePosition({ token: "a", time: -1, duration: 90 })).toBeNull();
    expect(parseLitePosition({ time: 1, duration: 90 })).toBeNull();
    expect(parseLitePosition(null)).toBeNull();
  });
});
