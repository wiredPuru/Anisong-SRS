const END_MARGIN_SECONDS = 15;

// Where a Random start clip begins. With a play length, the start leaves room
// for the whole length (and the usual end margin when the clip is long enough),
// so the song never begins closer to its end than the user asked to hear.
export function randomStartTime(duration: number, playLength = 0, random: () => number = Math.random): number {
  if (playLength <= 0) {
    const safeRange = duration - END_MARGIN_SECONDS;
    return safeRange > 0 ? random() * safeRange : random() * duration;
  }
  const withMargin = duration - Math.max(END_MARGIN_SECONDS, playLength);
  if (withMargin > 0) return random() * withMargin;
  const exact = duration - playLength;
  return exact > 0 ? random() * exact : 0;
}
