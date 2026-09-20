import { describe, expect, it } from "vitest";
import type { BonusCategoryResult } from "./quizScore.ts";
import { buildBurstPlan, burstTravel, type GradedAnswer } from "./scoreBurst.ts";

function grade(overrides: Partial<GradedAnswer> = {}): GradedAnswer {
  return {
    result: "pass",
    answered: true,
    pointsAwarded: 100,
    combo: 1,
    previousCombo: 0,
    bonusResults: [],
    ...overrides,
  };
}

function bonus(overrides: Partial<BonusCategoryResult> = {}): BonusCategoryResult {
  return {
    category: "songName",
    correct: true,
    pointsAwarded: 50,
    selectedLabel: "Tank!",
    correctLabel: "Tank!",
    ...overrides,
  };
}

describe("buildBurstPlan", () => {
  it("fires one travelling points burst for a plain correct answer", () => {
    const plan = buildBurstPlan(grade());
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: "points", label: "+100", points: 100, delayMs: 0, travels: true });
  });

  it("adds a combo tag from the second correct answer, not the first", () => {
    expect(buildBurstPlan(grade({ combo: 1 })).some((b) => b.kind === "combo")).toBe(false);
    const plan = buildBurstPlan(grade({ combo: 3, pointsAwarded: 150 }));
    expect(plan.map((b) => b.kind)).toEqual(["points", "combo"]);
    expect(plan[1]?.label).toBe("3x combo");
    expect(plan[1]?.travels).toBe(false);
  });

  it("staggers bonus bursts after the main one, in ascending order", () => {
    const plan = buildBurstPlan(grade({
      bonusResults: [bonus(), bonus({ category: "themeSlot", selectedLabel: "OP1", correctLabel: "OP1" })],
    }));
    expect(plan.map((b) => b.kind)).toEqual(["points", "bonus", "bonus"]);
    expect(plan.map((b) => b.label)).toEqual(["+100", "+50 song name", "+50 opening/ending"]);
    const delays = plan.map((b) => b.delayMs);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(new Set(delays).size).toBe(delays.length);
  });

  it("skips a bonus that scored nothing", () => {
    const plan = buildBurstPlan(grade({
      bonusResults: [bonus({ correct: false, pointsAwarded: 0 }), bonus({ category: "themeSlot" })],
    }));
    expect(plan.map((b) => b.label)).toEqual(["+100", "+50 opening/ending"]);
  });

  it("breaks a streak with a miss and a combo-lost tag", () => {
    const plan = buildBurstPlan(grade({ result: "fail", pointsAwarded: 0, combo: 0, previousCombo: 4 }));
    expect(plan.map((b) => b.kind)).toEqual(["miss", "comboLost"]);
    expect(plan[0]).toMatchObject({ label: "Miss", points: 0, travels: false });
  });

  it("omits the combo-lost tag when there was no streak to break", () => {
    const plan = buildBurstPlan(grade({ result: "fail", pointsAwarded: 0, combo: 0, previousCombo: 0 }));
    expect(plan.map((b) => b.kind)).toEqual(["miss"]);
  });

  it("calls a give-up revealed rather than a miss", () => {
    const plan = buildBurstPlan(grade({ result: "fail", answered: false, pointsAwarded: 0, combo: 0 }));
    expect(plan[0]?.label).toBe("Revealed");
  });

  it("still bursts a bonus that scored behind a missed anime guess", () => {
    const plan = buildBurstPlan(grade({
      result: "fail",
      pointsAwarded: 0,
      combo: 0,
      previousCombo: 2,
      bonusResults: [bonus({ category: "themeSlot" })],
    }));
    expect(plan.map((b) => b.kind)).toEqual(["miss", "comboLost", "bonus"]);
    expect(plan[2]).toMatchObject({ points: 50, travels: true });
  });

  it("gives every burst in one plan a unique id", () => {
    const plan = buildBurstPlan(grade({ combo: 2, bonusResults: [bonus(), bonus({ category: "themeSlot" })] }));
    expect(new Set(plan.map((b) => b.id)).size).toBe(plan.length);
  });
});

describe("burstTravel", () => {
  it("measures centre to centre", () => {
    const from = { left: 100, top: 200, width: 40, height: 20 };
    const to = { left: 500, top: 60, width: 100, height: 40 };
    expect(burstTravel(from, to)).toEqual({ dx: 430, dy: -130 });
  });

  it("is zero when both rects share a centre", () => {
    const rect = { left: 10, top: 10, width: 80, height: 30 };
    expect(burstTravel(rect, { left: 45, top: 20, width: 10, height: 10 })).toEqual({ dx: 0, dy: 0 });
  });
});
