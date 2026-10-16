import type { PartyEffects } from "~/composables/usePartyDisplay";

export type EffectGroup = "effects" | "playback";

export interface EffectOption {
  id: string;
  label: string;
  group: EffectGroup;
  on: (effects: PartyEffects) => boolean;
  set: (effects: PartyEffects, on: boolean) => PartyEffects;
}

export const NO_EFFECTS: PartyEffects = { blur: 0, pixelate: 0, decay: false, decaySeconds: 20, muted: false, picture: "video" };
export const FULL_BLUR = 40;
export const DEFAULT_PIXELATE = 32;

// Add or drop an option here and every chip row follows.
export const EFFECT_OPTIONS: readonly EffectOption[] = [
  { id: "blur", label: "Blur", group: "effects", on: (e) => e.blur >= FULL_BLUR, set: (e, on) => ({ ...e, blur: on ? FULL_BLUR : 0 }) },
  { id: "pixelate", label: "Pixelate", group: "effects", on: (e) => e.pixelate > 0, set: (e, on) => ({ ...e, pixelate: on ? DEFAULT_PIXELATE : 0 }) },
  { id: "bubbles", label: "Bubbles", group: "effects", on: (e) => e.picture === "bubbles", set: (e, on) => ({ ...e, picture: on ? "bubbles" : "video" }) },
  { id: "music", label: "Music player", group: "playback", on: (e) => e.picture === "music", set: (e, on) => ({ ...e, picture: on ? "music" : "video" }) },
  { id: "muted", label: "Mute", group: "playback", on: (e) => e.muted, set: (e, on) => ({ ...e, muted: on }) },
];

export const EFFECT_GROUPS: readonly { id: EffectGroup; label: string }[] = [
  { id: "effects", label: "Effects" },
  { id: "playback", label: "Playback" },
];

export function optionsIn(group: EffectGroup): EffectOption[] {
  return EFFECT_OPTIONS.filter((option) => option.group === group);
}

export function isPlain(effects: PartyEffects): boolean {
  return JSON.stringify(effects) === JSON.stringify(NO_EFFECTS);
}

export function toggleOption(base: PartyEffects, option: EffectOption): PartyEffects {
  const { random: _flag, ...rest } = base;
  return option.set(rest, !option.on(rest));
}

// Random is a flag the server resolves into blur, pixelate or bubbles as each
// song starts, so every song gets its own pick. Setting it clears the picks.
export function setRandom(base: PartyEffects, on: boolean): PartyEffects {
  const cleared = optionsIn("effects").reduce((acc, option) => option.set(acc, false), base);
  if (!on) {
    const { random: _flag, ...rest } = cleared;
    return rest;
  }
  return { ...cleared, random: true };
}

export interface EffectPreset {
  name: string;
  effects: PartyEffects;
}

export const PRESET_STORAGE_KEY = "gaqSrs:partyEffectPresets";
export const MAX_PRESETS = 12;

export function parsePresets(raw: string | null): EffectPreset[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.flatMap((entry): EffectPreset[] => {
      if (typeof entry !== "object" || entry === null) return [];
      const { name, effects } = entry as Record<string, unknown>;
      if (typeof name !== "string" || !name.trim() || typeof effects !== "object" || effects === null) return [];
      return [{ name: name.trim().slice(0, 24), effects: { ...NO_EFFECTS, ...(effects as Partial<PartyEffects>) } }];
    }).slice(0, MAX_PRESETS);
  } catch {
    return [];
  }
}

export function addPreset(presets: EffectPreset[], preset: EffectPreset): EffectPreset[] {
  const name = preset.name.trim().slice(0, 24);
  if (!name) return presets;
  const rest = presets.filter((existing) => existing.name !== name);
  return [...rest, { ...preset, name }].slice(-MAX_PRESETS);
}

export function removePreset(presets: EffectPreset[], name: string): EffectPreset[] {
  return presets.filter((preset) => preset.name !== name);
}
