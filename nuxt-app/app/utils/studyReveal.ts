// answerable is false for a typed round that cannot be submitted (the card has
// no AniList id to grade against), so no countdown runs toward a dead end.
export function canAutoReveal(mode: string, started: boolean, revealed: boolean, answerable: boolean): boolean {
  return mode !== "off" && started && !revealed && answerable;
}

export type AutoRevealExpiryAction = "reveal" | "submit" | "hold" | "none";

// What the countdown does when it runs out. A typed round is submitted rather
// than revealed, and waits ("hold") while an overlay blocks answering so it is
// never submitted behind one.
export function autoRevealExpiryAction(state: { typedAnswers: boolean; blocked: boolean; resultShown: boolean }): AutoRevealExpiryAction {
  if (!state.typedAnswers) return "reveal";
  if (state.resultShown) return "none";
  return state.blocked ? "hold" : "submit";
}
