export function canAutoReveal(typedAnswers: boolean, mode: string, started: boolean, revealed: boolean): boolean {
  return !typedAnswers && mode !== "off" && started && !revealed;
}

export interface TypedAnswerVideoState {
  hideVideo: boolean;
  hiddenBeforeTypedAnswers: boolean | null;
}

export function transitionTypedAnswerVideo(
  enabled: boolean,
  autoRevealTargetsVideo: boolean,
  hideVideo: boolean,
  hiddenBeforeTypedAnswers: boolean | null,
): TypedAnswerVideoState {
  if (enabled && autoRevealTargetsVideo) {
    return { hideVideo: false, hiddenBeforeTypedAnswers: hideVideo };
  }
  if (!enabled && hiddenBeforeTypedAnswers !== null) {
    return { hideVideo: hiddenBeforeTypedAnswers, hiddenBeforeTypedAnswers: null };
  }
  return { hideVideo, hiddenBeforeTypedAnswers };
}
