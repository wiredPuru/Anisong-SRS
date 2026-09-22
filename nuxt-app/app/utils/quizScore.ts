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

// Bonus categories (Song name, Opening/Ending number) add flat points on top
// of the anime-name score. They deliberately never touch
// combo, correct, answered, or bestCombo - those stay the anime-recognition
// signal exactly as applyQuizResult defines it, not a mix of two different
// kinds of question.
export const BONUS_CATEGORY_POINTS = 50;

export interface BonusCategoryResult {
  category: "themeSlot" | "songName";
  correct: boolean;
  pointsAwarded: number;
  selectedLabel: string;
  correctLabel: string;
  // Set when the deck grades on this category (feature 71): the row then
  // explains the Pass/Fail instead of adding points, and always awards 0.
  required?: boolean;
}

export function applyBonusCategory(current: QuizScore, correct: boolean): QuizScoreTransition {
  if (!correct) return { score: current, pointsAwarded: 0 };
  return { score: { ...current, score: current.score + BONUS_CATEGORY_POINTS }, pointsAwarded: BONUS_CATEGORY_POINTS };
}
