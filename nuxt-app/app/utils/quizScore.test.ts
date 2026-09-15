import { describe, expect, it } from "vitest";
import { applyQuizResult, createQuizScore, quizAccuracy } from "./quizScore";

describe("typed-answer quiz score", () => {
  it("awards a capped combo bonus", () => {
    let score = createQuizScore();
    const awards: number[] = [];
    for (let index = 0; index < 7; index += 1) {
      const transition = applyQuizResult(score, "pass");
      score = transition.score;
      awards.push(transition.pointsAwarded);
    }

    expect(awards).toEqual([100, 125, 150, 175, 200, 200, 200]);
    expect(score).toEqual({ score: 1150, combo: 7, bestCombo: 7, correct: 7, answered: 7 });
  });

  it("resets the active combo on fail while retaining totals and best combo", () => {
    const first = applyQuizResult(createQuizScore(), "pass").score;
    const second = applyQuizResult(first, "pass").score;
    const failed = applyQuizResult(second, "fail");

    expect(failed.pointsAwarded).toBe(0);
    expect(failed.score).toEqual({ score: 225, combo: 0, bestCombo: 2, correct: 2, answered: 3 });
    expect(quizAccuracy(failed.score)).toBe(67);
  });

  it("does not mutate the previous score object", () => {
    const score = createQuizScore();
    applyQuizResult(score, "pass");
    expect(score).toEqual(createQuizScore());
  });

  it("omits accuracy until a typed answer has been scored", () => {
    expect(quizAccuracy(createQuizScore())).toBeNull();
  });
});
