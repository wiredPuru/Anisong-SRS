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

export type AudioFirstStyle = "blind" | "blur" | "pixelate" | "peephole" | "random";
export type AudioFirstTreatment = Exclude<AudioFirstStyle, "random">;
export type AudioFirstObscure = Exclude<AudioFirstTreatment, "blind">;

export const AUDIO_FIRST_STYLE_OPTIONS: readonly { value: AudioFirstStyle; label: string }[] = [
  { value: "blind", label: "Blind" },
  { value: "blur", label: "Blur" },
  { value: "pixelate", label: "Pixelate" },
  { value: "peephole", label: "Peephole" },
  { value: "random", label: "Random" },
];

const RANDOM_POOL: readonly AudioFirstObscure[] = ["blur", "pixelate", "peephole"];

/** Mixes an integer seed so neighbouring seeds (one showing to the next) land far apart. */
function hashSeed(seed: number): number {
  let h = Math.trunc(seed) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** The treatment a style gives one showing. Random never resolves to Blind. */
export function resolveAudioFirstStyle(style: AudioFirstStyle, seed: number): AudioFirstTreatment {
  if (style !== "random") return style;
  return RANDOM_POOL[hashSeed(seed) % RANDOM_POOL.length]!;
}

/**
 * The player's obscure value: a treatment only while the audio-first rule hides
 * the picture and nothing stronger (session Hide Video, Auto Reveal) already does.
 */
export function audioFirstObscure(state: {
  hidden: boolean;
  forcedBlind: boolean;
  treatment: AudioFirstTreatment;
}): AudioFirstObscure | null {
  if (!state.hidden || state.forcedBlind || state.treatment === "blind") return null;
  return state.treatment;
}

/** The style's label, or null for Blind so a badge can read plain "Audio first". */
export function audioFirstStyleLabel(style: AudioFirstStyle): string | null {
  if (style === "blind") return null;
  return AUDIO_FIRST_STYLE_OPTIONS.find((option) => option.value === style)?.label ?? null;
}

export const PEEPHOLE_RADIUS = 0.14;

/**
 * Where the peephole sits after `seconds` of drift, as percentages of the frame.
 * A slow Lissajous path whose span keeps the circle's centre clear of the edges.
 */
export function peepholeCenter(seconds: number, seed: number): { x: number; y: number } {
  const phase = (hashSeed(seed) % 628) / 100;
  return {
    x: 50 + 30 * Math.sin(seconds * 0.5 + phase),
    y: 50 + 24 * Math.cos(seconds * 0.37 + phase),
  };
}
