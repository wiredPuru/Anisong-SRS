export type QuizResult = "pass" | "fail";

export interface QuizScore {
  score: number;
  combo: number;
  bestCombo: number;
  correct: number;
  answered: number;
}

export interface QuizScoreTransition {
  score: QuizScore;
  pointsAwarded: number;
}

export function createQuizScore(): QuizScore {
  return { score: 0, combo: 0, bestCombo: 0, correct: 0, answered: 0 };
}

export function applyQuizResult(current: QuizScore, result: QuizResult): QuizScoreTransition {
  if (result === "fail") {
    return {
      score: { ...current, combo: 0, answered: current.answered + 1 },
      pointsAwarded: 0,
    };
  }

  const combo = current.combo + 1;
  const pointsAwarded = 100 + Math.min(current.combo, 4) * 25;
  return {
    score: {
      score: current.score + pointsAwarded,
      combo,
      bestCombo: Math.max(current.bestCombo, combo),
      correct: current.correct + 1,
      answered: current.answered + 1,
    },
    pointsAwarded,
  };
}

export function quizAccuracy(score: QuizScore): number | null {
  if (score.answered === 0) return null;
  return Math.round((score.correct / score.answered) * 100);
}
