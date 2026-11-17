export interface AudioFirstVeilState {
  audioFirst: boolean;
  /** A hidden answer was revealed during this showing. */
  answerRevealed: boolean;
  /** The user asked for the picture on this showing (V, the Video toggle, or Reveal). */
  shownByUser: boolean;
  /** Auto Reveal fired on this showing. */
  revealedByTimer: boolean;
}

/**
 * Whether an audio-first card's picture stays hidden. Only a reveal lifts it, so
 * when nothing ever hid the answer (manual Study with Hide Info off) the
 * picture waits for the user instead of showing at once.
 */
export function audioFirstVeiled(state: AudioFirstVeilState): boolean {
  return state.audioFirst && !state.answerRevealed && !state.shownByUser && !state.revealedByTimer;
}

/** True for the hidden-to-shown transition of a watched "answer hidden" flag. */
export function isAnswerReveal(hidden: boolean, wasHidden: boolean | undefined): boolean {
  return wasHidden === true && !hidden;
}
