import type { PartyPicture } from "~/composables/usePartyDisplay";
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";
import { FULL_FRAME } from "./partyCensorBoxes";
import { togglePicture } from "./partyPicture";
import { skipTarget } from "./partySkip";

export type HostActionId =
  | "playPause"
  | "reveal"
  | "next"
  | "previous"
  | "skip"
  | "mute"
  | "blur"
  | "pixelate"
  | "picture"
  | "censor"
  | "timer"
  | "scoreboard";

export interface HostActionContext {
  /** The hiding picture V brings back; the picture action updates it. */
  lastHidingPicture: PartyPicture;
  /** Seconds the censor lift waits, the host's preview lead. */
  previewLead: number;
}

export interface HostAction {
  id: HostActionId;
  label: string;
  /** `KeyboardEvent.key` values, lowercased, that run this action. */
  keys: readonly string[];
  needsGame: boolean;
  build(state: PartyHostState, ctx: HostActionContext): PartyHostCommand | null;
}

export const TIMER_HOTKEY_SECONDS = 15;
export const BLUR_HOTKEY_PX = 14;
export const PIXELATE_HOTKEY_PX = 24;

export const HOST_ACTIONS: readonly HostAction[] = [
  { id: "playPause", label: "Play / pause", keys: [" "], needsGame: true, build: (s) => ({ type: s.playing ? "pause" : "play" }) },
  { id: "reveal", label: "Reveal", keys: ["r"], needsGame: true, build: () => ({ type: "reveal" }) },
  { id: "next", label: "Next song", keys: ["n", "arrowright"], needsGame: true, build: () => ({ type: "next" }) },
  { id: "previous", label: "Previous song", keys: ["p", "arrowleft"], needsGame: true, build: () => ({ type: "previous" }) },
  {
    id: "skip",
    label: "Skip to end",
    keys: ["e"],
    needsGame: true,
    build(s) {
      const seconds = skipTarget(s.position?.duration);
      return seconds === null ? null : { type: "seek", seconds, skip: true };
    },
  },
  {
    id: "mute",
    label: "Mute",
    keys: ["m"],
    needsGame: false,
    build: (s) => ({ type: "effects", target: "current", effects: { ...s.effects, muted: !s.effects.muted } }),
  },
  {
    id: "blur",
    label: "Blur",
    keys: ["b"],
    needsGame: true,
    build: (s) => ({ type: "effects", target: "current", effects: { ...s.effects, blur: s.effects.blur > 0 ? 0 : BLUR_HOTKEY_PX } }),
  },
  {
    id: "pixelate",
    label: "Pixelate",
    keys: ["x"],
    needsGame: true,
    build: (s) => ({
      type: "effects",
      target: "current",
      effects: { ...s.effects, pixelate: s.effects.pixelate > 0 ? 0 : PIXELATE_HOTKEY_PX },
    }),
  },
  {
    id: "picture",
    label: "Hide picture",
    keys: ["v"],
    needsGame: true,
    build(s, ctx) {
      const toggled = togglePicture(s.effects.picture, ctx.lastHidingPicture);
      ctx.lastHidingPicture = toggled.lastHiding;
      return { type: "effects", target: "current", effects: { ...s.effects, picture: toggled.picture } };
    },
  },
  {
    id: "censor",
    label: "Censor whole screen",
    keys: ["c"],
    needsGame: true,
    build: (s, ctx) =>
      s.censor
        ? { type: "censor", censor: null, delay: ctx.previewLead }
        : { type: "censor", censor: { boxes: [FULL_FRAME], style: s.censorStyle, muted: false } },
  },
  {
    id: "timer",
    label: "Start 15s timer",
    keys: ["t"],
    needsGame: true,
    build: () => ({ type: "timer", seconds: TIMER_HOTKEY_SECONDS, autoReveal: true }),
  },
  {
    id: "scoreboard",
    label: "Show scoreboard",
    keys: ["s"],
    needsGame: false,
    build: (s) => ({ type: "score", op: "show", visible: !s.scoreboard.visible }),
  },
];

export function hostHasGame(state: PartyHostState): boolean {
  return state.index >= 0 && state.queue.length > 0;
}

export function hostActionById(id: HostActionId): HostAction {
  const action = HOST_ACTIONS.find((candidate) => candidate.id === id);
  if (!action) throw new Error(`Unknown host action: ${id}`);
  return action;
}

export function hostActionForKey(key: string): HostAction | null {
  const lowered = key.toLowerCase();
  return HOST_ACTIONS.find((action) => action.keys.includes(lowered)) ?? null;
}

/** The command an action sends now, or null when it cannot run (no game, no duration yet). */
export function buildHostAction(action: HostAction, state: PartyHostState | null, ctx: HostActionContext): PartyHostCommand | null {
  if (!state) return null;
  if (action.needsGame && !hostHasGame(state)) return null;
  return action.build(state, ctx);
}

/** How an action's first key reads in the UI: "Space", "→", "X". */
export function hostActionKeyLabel(action: HostAction): string {
  const key = action.keys[0] ?? "";
  if (key === " ") return "Space";
  if (key === "arrowright") return "→";
  if (key === "arrowleft") return "←";
  return key.toUpperCase();
}
