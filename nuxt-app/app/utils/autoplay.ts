export type AutoplayPlan = "none" | "play" | "download-then-play";

export interface AutoplayInputs {
  autoplay: boolean;
  // Something is loadable: a local file, or a remote URL the Clip source allows.
  hasSource: boolean;
  // The kind that would play is remote-only and the library has a place to save it.
  canDownloadFirst: boolean;
}

export function planAutoplay({ autoplay, hasSource, canDownloadFirst }: AutoplayInputs): AutoplayPlan {
  if (!autoplay || !hasSource) return "none";
  return canDownloadFirst ? "download-then-play" : "play";
}

// On unless the user switched it off: nothing stored means a fresh profile.
export function parseAutoplayPreference(stored: string | null): boolean {
  return stored !== "0";
}
