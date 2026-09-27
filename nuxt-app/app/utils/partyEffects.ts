/** How strong an effect is after `elapsed` seconds of play, fading linearly to 0 when it decays. */
export function effectStrength(level: number, decay: boolean, decaySeconds: number, elapsed: number): number {
  if (level <= 0) return 0;
  if (!decay || decaySeconds <= 0) return level;
  return level * Math.max(0, 1 - Math.max(0, elapsed) / decaySeconds);
}

// Below 2px a "block" is the picture's own pixels, so pixelation is simply off.
const MIN_BLOCK = 2;

export function pixelBlockSize(pixelate: number, decay: boolean, decaySeconds: number, elapsed: number): number {
  const size = Math.round(effectStrength(pixelate, decay, decaySeconds, elapsed));
  return size < MIN_BLOCK ? 0 : size;
}
