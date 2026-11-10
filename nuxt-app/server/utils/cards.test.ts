import { describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { baseDueCondition, LEARNING_BACKLOG_CAP, orderDueQueue, pathsToRemove, pickPracticeId, pickRandomDueOrder } from "./cards.ts";

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

describe("orderDueQueue", () => {
  interface Queued extends Pooled {
    box: number;
  }
  const entry = (id: number, box: number, nextReviewAt: Date = today): Queued => ({ id, box, nextReviewAt });
  const ids = (picks: Queued[]) => picks.map((pick) => pick.id);
  const none = new Set<number>();

  it("serves a due review before learning and new cards", () => {
    const pool = [entry(1, 1), entry(2, 3), entry(3, 1)];
    expect(orderDueQueue(pool, new Set([1]), [], 1, seedDay)[0].id).toBe(2);
  });

  it("serves a learning card outside the recent window before an older new card", () => {
    const pool = [entry(1, 1, earlier), entry(2, 1, earlier), entry(3, 1, today)];
    expect(orderDueQueue(pool, new Set([3]), [], 1, seedDay)[0].id).toBe(3);
  });

  it("introduces a new card while the learning backlog is under the cap and all learning is recent", () => {
    const pool = [entry(1, 1), entry(2, 1)];
    expect(orderDueQueue(pool, new Set([1]), [1], 1, seedDay)[0].id).toBe(2);
  });

  it("introduces no new card at the backlog cap and repeats the longest-ago learning card", () => {
    const learning = Array.from({ length: LEARNING_BACKLOG_CAP }, (_, index) => entry(index + 1, 1));
    const pool = [...learning, entry(90, 1), entry(91, 1)];
    const reviewed = new Set(learning.map((item) => item.id));
    const recent = [3, 1, 5, 2, 4];
    expect(orderDueQueue(pool, reviewed, recent, 1, seedDay)[0].id).toBe(3);
  });

  it("serves the oldest recent card when only recent learning cards remain", () => {
    const pool = [entry(1, 1), entry(2, 1)];
    expect(orderDueQueue(pool, new Set([1, 2]), [2, 1], 1, seedDay)[0].id).toBe(2);
  });

  it("serves a lone learning card even though it was just reviewed", () => {
    expect(orderDueQueue([entry(1, 1)], new Set([1]), [1], 1, seedDay)[0].id).toBe(1);
  });

  it("treats a box-1 card with no review as new and keeps earlier-day new cards first", () => {
    const pool = [entry(1, 1, earlier), entry(2, 1, today)];
    expect(orderDueQueue(pool, none, [], 1, seedDay)[0].id).toBe(1);
  });

  it("returns an empty list for an empty pool", () => {
    expect(orderDueQueue([], none, [1, 2], 3, seedDay)).toEqual([]);
  });

  it("builds a lookahead that matches serving the same cards one at a time", () => {
    const pool = [entry(1, 1), entry(2, 1), entry(3, 1), entry(4, 1)];
    const reviewed = new Set([1]);
    const batch = ids(orderDueQueue(pool, reviewed, [], 3, seedDay));
    const served: number[] = [];
    const seen = new Set(reviewed);
    for (let step = 0; step < 3; step += 1) {
      const [next] = orderDueQueue(
        pool.filter((item) => !served.includes(item.id)),
        seen,
        served,
        1,
        seedDay,
      );
      served.push(next.id);
      seen.add(next.id);
    }
    expect(batch).toEqual(served);
  });

  it("keeps new cards out until the learning backlog drains across a session", () => {
    const pool = Array.from({ length: 30 }, (_, index) => entry(index + 1, 1));
    const reviewed = new Set<number>();
    const recent: number[] = [];
    const introduced = new Set<number>();
    for (let review = 0; review < 40; review += 1) {
      const [next] = orderDueQueue(pool, reviewed, recent, 1, seedDay);
      introduced.add(next.id);
      reviewed.add(next.id);
      recent.splice(0, recent.length, ...recent.filter((id) => id !== next.id), next.id);
      if (recent.length > 5) recent.shift();
      expect(introduced.size).toBeLessThanOrEqual(LEARNING_BACKLOG_CAP);
    }
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

describe("pickPracticeId", () => {
  const pool = [
    { id: 1, lastReviewedAt: 300 },
    { id: 2, lastReviewedAt: 100 },
    { id: 3, lastReviewedAt: 200 },
  ];

  it("serves the least recently reviewed card first", () => {
    expect(pickPracticeId(pool, [])).toBe(2);
  });

  it("puts never-reviewed cards ahead of reviewed ones", () => {
    expect(pickPracticeId([...pool, { id: 9, lastReviewedAt: 0 }], [])).toBe(9);
  });

  it("holds back the cards the session just answered", () => {
    expect(pickPracticeId(pool, [2])).toBe(3);
  });

  it("falls back to the one answered longest ago when only recent cards remain", () => {
    expect(pickPracticeId(pool, [3, 1, 2])).toBe(3);
  });

  it("honours a preferred card that is in the pool and ignores one that is not", () => {
    expect(pickPracticeId(pool, [], 1)).toBe(1);
    expect(pickPracticeId(pool, [], 42)).toBe(2);
  });

  it("returns nothing for an empty pool", () => {
    expect(pickPracticeId([], [])).toBeUndefined();
  });
});
