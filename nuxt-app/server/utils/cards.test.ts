import { describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { baseDueCondition, orderAwayFromRecent, pathsToRemove, pickRandomDueOrder } from "./cards.ts";

const themesOnly = vi.hoisted(() => ({ value: false }));
const dailyNewCardLimit = vi.hoisted(() => ({ value: null as number | null }));
vi.mock("./mediaLibrary.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./mediaLibrary.ts")>()),
  getThemesOnly: () => themesOnly.value,
  getDailyNewCardLimit: () => dailyNewCardLimit.value,
}));

describe("baseDueCondition themes-only filter", () => {
  const dueSql = () => db.select().from(card).where(baseDueCondition()).toSQL().sql;

  it("adds no song filter by default", () => {
    themesOnly.value = false;
    expect(dueSql()).not.toContain("animethemes_theme_id");
  });

  it("restricts to songs with an AnimeThemes theme id when on", () => {
    themesOnly.value = true;
    expect(dueSql()).toMatch(/animethemes_theme_id" is not null/i);
  });
});

describe("pathsToRemove", () => {
  it("returns nothing for empty input", () => {
    expect(pathsToRemove([], [])).toEqual([]);
  });

  it("drops nulls and collapses duplicates", () => {
    expect(pathsToRemove(["/a.webm", null, "/a.webm", "/b.mp3"], [])).toEqual(["/a.webm", "/b.mp3"]);
  });

  it("keeps a path a remaining card still references", () => {
    expect(pathsToRemove(["/a.webm", "/b.mp3"], [null, "/b.mp3"])).toEqual(["/a.webm"]);
  });
});

interface Pooled {
  id: number;
  nextReviewAt: Date;
}

const earlier = new Date("2026-09-01T00:00:00.000Z");
const today = new Date("2026-09-05T00:00:00.000Z");

function tiedPool(): Pooled[] {
  // Sorted ascending by nextReviewAt, as getNextDueCard/getUpcomingDueCards
  // always pass it in - one clearly overdue card from an earlier day, then
  // several cards tied on today's date (e.g. a bulk import).
  return [
    { id: 1, nextReviewAt: earlier },
    { id: 2, nextReviewAt: today },
    { id: 3, nextReviewAt: today },
    { id: 4, nextReviewAt: today },
  ];
}

// The tie-break is a deterministic hash of (id, calendar day), not
// Math.random() - these seed dates were picked because they're known to
// order the tied ids differently, proving the tie-break isn't secretly just
// insertion order in disguise.
const seedDay = new Date("2026-09-05T12:00:00.000Z");
const nextSeedDay = new Date("2026-09-06T12:00:00.000Z");

describe("orderAwayFromRecent", () => {
  const ids = (picks: Pooled[]) => picks.map((entry) => entry.id);

  it("matches pickRandomDueOrder exactly when nothing is recent", () => {
    expect(ids(orderAwayFromRecent(tiedPool(), [], 4, seedDay))).toEqual(ids(pickRandomDueOrder(tiedPool(), 4, seedDay)));
  });

  it("never serves a recent card while any other card is due", () => {
    const leader = pickRandomDueOrder(tiedPool().slice(1), 1, seedDay)[0].id;
    const [next] = orderAwayFromRecent(tiedPool().slice(1), [leader], 1, seedDay);
    expect(next.id).not.toBe(leader);
  });

  it("does not repeat the same card across a run of box-1 reviews", () => {
    const pool = tiedPool().slice(1);
    const recent: number[] = [];
    const served: number[] = [];
    for (let review = 0; review < 6; review += 1) {
      const [next] = orderAwayFromRecent(pool, recent, 1, seedDay);
      served.push(next.id);
      recent.splice(0, recent.length, ...recent.filter((id) => id !== next.id), next.id);
    }
    for (let index = 1; index < served.length; index += 1) {
      expect(served[index]).not.toBe(served[index - 1]);
    }
  });

  it("serves the card reviewed longest ago when every due card is recent", () => {
    const pool = tiedPool().slice(1);
    expect(orderAwayFromRecent(pool, [3, 4, 2], 1, seedDay)[0].id).toBe(3);
    expect(ids(orderAwayFromRecent(pool, [3, 4, 2], 3, seedDay))).toEqual([3, 4, 2]);
  });

  it("alternates between two due cards", () => {
    const pool: Pooled[] = [
      { id: 2, nextReviewAt: today },
      { id: 3, nextReviewAt: today },
    ];
    const first = orderAwayFromRecent(pool, [], 1, seedDay)[0].id;
    const second = orderAwayFromRecent(pool, [first], 1, seedDay)[0].id;
    const third = orderAwayFromRecent(pool, [first, second], 1, seedDay)[0].id;
    expect(second).not.toBe(first);
    expect(third).toBe(first);
  });

  it("still serves a lone due card even though it was just reviewed", () => {
    const pool: Pooled[] = [{ id: 2, nextReviewAt: today }];
    expect(orderAwayFromRecent(pool, [2], 1, seedDay)[0].id).toBe(2);
  });

  it("keeps an earlier-day card ahead of today's cards", () => {
    expect(orderAwayFromRecent(tiedPool(), [3], 1, seedDay)[0].id).toBe(1);
  });

  it("ignores recent ids that are not in the pool", () => {
    expect(ids(orderAwayFromRecent(tiedPool(), [99], 4, seedDay))).toEqual(ids(pickRandomDueOrder(tiedPool(), 4, seedDay)));
  });

  it("returns an empty list for an empty pool", () => {
    expect(orderAwayFromRecent([], [1, 2], 1, seedDay)).toEqual([]);
  });
});

describe("pickRandomDueOrder", () => {
  it("returns undefined-safe empty array for an empty pool", () => {
    expect(pickRandomDueOrder([], 1)).toEqual([]);
  });

  it("always picks the earlier-day card first over same-day ties", () => {
    expect(pickRandomDueOrder(tiedPool(), 1, seedDay)[0].id).toBe(1);
    expect(pickRandomDueOrder(tiedPool(), 1, nextSeedDay)[0].id).toBe(1);
  });

  it("gives the same order across repeated calls on the same day", () => {
    const first = pickRandomDueOrder(tiedPool(), 4, seedDay).map((c) => c.id);
    const second = pickRandomDueOrder(tiedPool(), 4, seedDay).map((c) => c.id);
    expect(first).toEqual(second);
  });

  it("changes the same-day tie-break order once the day rolls over", () => {
    const pool: Pooled[] = [
      { id: 2, nextReviewAt: today },
      { id: 3, nextReviewAt: today },
      { id: 4, nextReviewAt: today },
    ];
    const orderToday = pickRandomDueOrder(pool, 1, seedDay)[0].id;
    const orderNextDay = pickRandomDueOrder(pool, 1, nextSeedDay)[0].id;
    expect(orderToday).not.toBe(orderNextDay);
  });

  it("never repeats a card and stops once the pool is exhausted", () => {
    const picks = pickRandomDueOrder(tiedPool(), 10, seedDay);
    expect(picks).toHaveLength(4);
    expect(new Set(picks.map((c) => c.id)).size).toBe(4);
  });

  it("treats two timestamps just minutes apart but on different calendar days as different buckets", () => {
    const pool: Pooled[] = [
      { id: 1, nextReviewAt: new Date("2026-09-04T23:59:00.000Z") },
      { id: 2, nextReviewAt: new Date("2026-09-05T00:01:00.000Z") },
    ];
    const [first] = pickRandomDueOrder(pool, 1, seedDay);
    expect(first.id).toBe(1);
  });

  it("treats two timestamps far apart but on the same calendar day as tied", () => {
    const pool: Pooled[] = [
      { id: 1, nextReviewAt: new Date("2026-09-05T00:01:00.000Z") },
      { id: 2, nextReviewAt: new Date("2026-09-05T23:59:00.000Z") },
    ];
    const pickedOnSeedDay = pickRandomDueOrder(pool, 1, seedDay)[0].id;
    const pickedOnNextSeedDay = pickRandomDueOrder(pool, 1, nextSeedDay)[0].id;
    expect(pickedOnSeedDay).not.toBe(pickedOnNextSeedDay);
  });
});

describe("baseDueCondition grading criterion", () => {
  const dueSql = (criterion: Parameters<typeof baseDueCondition>[1]) =>
    db.select().from(card).where(baseDueCondition(false, criterion)).toSQL();

  it("defaults to the title track stored on the card row", () => {
    const { sql: text } = dueSql(undefined);
    expect(text).toContain(`"card"."next_review_at" <=`);
    expect(text).not.toContain("card_track");
  });

  it.each(["song", "title+song", "title+slot+artist"] as const)("reads the %s track from card_track", (criterion) => {
    const { sql: text, params } = dueSql(criterion);
    expect(text).toContain(`"card_track"."next_review_at"`);
    expect(text).toContain(`"card_track"."card_id" = "card"."id"`);
    expect(params).toContain(criterion);
  });
});

describe("baseDueCondition daily new-card cap", () => {
  // The cap holds back cards never reviewed *for this criterion*: a card
  // already known by title is still new the first time it is asked by song.
  const cappedSql = (criterion: Parameters<typeof baseDueCondition>[1]) => {
    dailyNewCardLimit.value = 0;
    try {
      return db.select().from(card).where(baseDueCondition(false, criterion)).toSQL();
    } finally {
      dailyNewCardLimit.value = null;
    }
  };

  it("scopes the already-reviewed subquery to the active criterion", () => {
    const { sql: text, params } = cappedSql("song");
    expect(text).toMatch(/from "review_log" where "review_log"\."criterion" = \?/);
    expect(params).toContain("song");
  });

  it("scopes it to the title track by default", () => {
    const { params } = cappedSql(undefined);
    expect(params).toContain("title");
  });

  it("does not filter by criterion when the cap is not in force", () => {
    dailyNewCardLimit.value = null;
    expect(db.select().from(card).where(baseDueCondition(false, "song")).toSQL().sql).not.toContain("review_log");
  });
});
