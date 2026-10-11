export type HotkeyScope = "study" | "listen" | "preview";

export type HotkeyActionId =
  | "playPause"
  | "hideVideo"
  | "hideCover"
  | "hideInfo"
  | "ambient"
  | "flipCard"
  | "previousCard"
  | "sessionLog"
  | "editCard"
  | "undo"
  | "pass"
  | "fail"
  | "reveal"
  | "listenNext"
  | "listenPrevious"
  | "expand";

export interface HotkeyAction {
  id: HotkeyActionId;
  label: string;
  scopes: HotkeyScope[];
  defaults: { primary: string; alternate: string | null };
}

export interface HotkeyBinding {
  primary: string | null;
  alternate: string | null;
}

export type HotkeyBindings = Record<HotkeyActionId, HotkeyBinding>;

export interface HotkeyEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

const BOTH_PLAYERS: HotkeyScope[] = ["study", "listen"];

export const HOTKEY_ACTIONS: readonly HotkeyAction[] = [
  { id: "playPause", label: "Play / pause", scopes: ["study", "listen", "preview"], defaults: { primary: "space", alternate: "s" } },
  { id: "hideVideo", label: "Hide video", scopes: BOTH_PLAYERS, defaults: { primary: "v", alternate: null } },
  { id: "hideCover", label: "Hide cover", scopes: BOTH_PLAYERS, defaults: { primary: "c", alternate: null } },
  { id: "hideInfo", label: "Hide info", scopes: BOTH_PLAYERS, defaults: { primary: "i", alternate: null } },
  { id: "ambient", label: "Ambient mode", scopes: BOTH_PLAYERS, defaults: { primary: "a", alternate: null } },
  { id: "flipCard", label: "Flip card", scopes: BOTH_PLAYERS, defaults: { primary: "d", alternate: null } },
  { id: "previousCard", label: "Previous card", scopes: ["study"], defaults: { primary: "p", alternate: null } },
  { id: "sessionLog", label: "Session log", scopes: ["study"], defaults: { primary: "l", alternate: null } },
  { id: "editCard", label: "Edit card", scopes: ["study"], defaults: { primary: "e", alternate: null } },
  { id: "undo", label: "Undo last review", scopes: ["study"], defaults: { primary: "u", alternate: null } },
  { id: "pass", label: "Pass", scopes: ["study"], defaults: { primary: "arrowright", alternate: null } },
  { id: "fail", label: "Fail", scopes: ["study"], defaults: { primary: "arrowleft", alternate: null } },
  { id: "reveal", label: "Reveal", scopes: ["listen"], defaults: { primary: "r", alternate: null } },
  { id: "listenNext", label: "Next song", scopes: ["listen"], defaults: { primary: "arrowright", alternate: null } },
  { id: "listenPrevious", label: "Previous song", scopes: ["listen"], defaults: { primary: "arrowleft", alternate: null } },
  { id: "expand", label: "Expand player", scopes: ["preview"], defaults: { primary: "f", alternate: null } },
];

/** Lowercases `event.key` so Shift never changes a binding; the spacebar becomes "space". */
export function normalizeKey(key: string): string | null {
  if (key === " ") return "space";
  return key ? key.toLowerCase() : null;
}

/** The binding key an event represents, or null when a Ctrl/Cmd/Alt combo is held. */
export function eventKey(event: HotkeyEventLike): string | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  return normalizeKey(event.key);
}

const KEY_SYMBOLS: Record<string, string> = {
  space: "Space",
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  arrowdown: "↓",
};

export function formatKey(key: string): string {
  const symbol = KEY_SYMBOLS[key];
  if (symbol) return symbol;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export const HOTKEY_STORAGE_KEY = "gaqSrs:hotkeys";

const STORAGE_VERSION = 1;

// Enter, Escape and Tab are structural (submit, close, focus), and the rest are
// keys that never arrive alone or only come from an IME.
const RESERVED_KEYS: ReadonlySet<string> = new Set([
  "enter", "escape", "tab",
  "shift", "control", "alt", "altgraph", "meta", "os", "capslock",
  "dead", "unidentified", "process",
]);

export type HotkeySlot = "primary" | "alternate";

export type HotkeyValidation =
  | { ok: true }
  | { ok: false; reason: "reserved" }
  | { ok: false; reason: "duplicate" }
  | { ok: false; reason: "conflict"; conflictsWith: HotkeyActionId };

const ACTION_IDS = HOTKEY_ACTIONS.map((a) => a.id);

function actionById(id: HotkeyActionId): HotkeyAction {
  return HOTKEY_ACTIONS.find((a) => a.id === id)!;
}

function keysOf(binding: HotkeyBinding): string[] {
  return [binding.primary, binding.alternate].filter((k): k is string => k !== null);
}

// Conflicts only count where two actions can both fire: Pass and Listen's Next
// share the right arrow because they live on different pages.
function sharesScope(a: HotkeyAction, b: HotkeyAction): boolean {
  return a.scopes.some((scope) => b.scopes.includes(scope));
}

function defaultBindings(): HotkeyBindings {
  const entries = HOTKEY_ACTIONS.map((a) => [a.id, { ...a.defaults }] as const);
  return Object.fromEntries(entries) as HotkeyBindings;
}

export function resolveBindings(overrides: Partial<HotkeyBindings> = {}): HotkeyBindings {
  const bindings = defaultBindings();
  for (const id of ACTION_IDS) {
    const override = overrides[id];
    if (override) bindings[id] = { ...override };
  }
  return bindings;
}

export function validateBinding(
  bindings: HotkeyBindings,
  actionId: HotkeyActionId,
  slot: HotkeySlot,
  key: string,
): HotkeyValidation {
  if (RESERVED_KEYS.has(key)) return { ok: false, reason: "reserved" };
  const otherSlot: HotkeySlot = slot === "primary" ? "alternate" : "primary";
  if (bindings[actionId][otherSlot] === key) return { ok: false, reason: "duplicate" };
  const action = actionById(actionId);
  for (const other of HOTKEY_ACTIONS) {
    if (other.id === actionId || !sharesScope(action, other)) continue;
    if (keysOf(bindings[other.id]).includes(key)) return { ok: false, reason: "conflict", conflictsWith: other.id };
  }
  return { ok: true };
}

export type ApplyResult = { ok: true; bindings: HotkeyBindings } | Exclude<HotkeyValidation, { ok: true }>;

/** Sets one slot (null clears it). A key held by another action is refused, never taken. */
export function applyBinding(
  bindings: HotkeyBindings,
  actionId: HotkeyActionId,
  slot: HotkeySlot,
  key: string | null,
): ApplyResult {
  if (key !== null) {
    const result = validateBinding(bindings, actionId, slot, key);
    if (!result.ok) return result;
  }
  return { ok: true, bindings: { ...bindings, [actionId]: { ...bindings[actionId], [slot]: key } } };
}

/** Puts one action back to its default keys, refused if another action has taken either since. */
export function resetBinding(bindings: HotkeyBindings, actionId: HotkeyActionId): ApplyResult {
  const { primary, alternate } = actionById(actionId).defaults;
  let result: ApplyResult = { ok: true, bindings: { ...bindings, [actionId]: { primary: null, alternate: null } } };
  for (const [slot, key] of [["primary", primary], ["alternate", alternate]] as const) {
    if (!result.ok) break;
    result = applyBinding(result.bindings, actionId, slot, key);
  }
  return result;
}

function isDefault(id: HotkeyActionId, binding: HotkeyBinding): boolean {
  const { defaults } = actionById(id);
  return binding.primary === defaults.primary && binding.alternate === defaults.alternate;
}

export function serializeOverrides(bindings: HotkeyBindings): string {
  const overrides: Partial<HotkeyBindings> = {};
  for (const id of ACTION_IDS) {
    if (!isDefault(id, bindings[id])) overrides[id] = bindings[id];
  }
  return JSON.stringify({ v: STORAGE_VERSION, overrides });
}

function parseSlot(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const key = normalizeKey(value);
  return key === null || RESERVED_KEYS.has(key) ? undefined : key;
}

function parseOverride(value: unknown): HotkeyBinding | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const primary = parseSlot(record.primary);
  const alternate = parseSlot(record.alternate);
  if (primary === undefined || alternate === undefined) return null;
  if (primary !== null && primary === alternate) return null;
  return { primary, alternate };
}

// The action to put back to its default so a conflicting pair can coexist:
// the later one that was changed, else the earlier one.
function conflictingAction(bindings: HotkeyBindings): HotkeyActionId | null {
  for (let i = 0; i < HOTKEY_ACTIONS.length; i++) {
    for (let j = i + 1; j < HOTKEY_ACTIONS.length; j++) {
      const a = HOTKEY_ACTIONS[i]!;
      const b = HOTKEY_ACTIONS[j]!;
      if (!sharesScope(a, b)) continue;
      const taken = keysOf(bindings[b.id]);
      if (!keysOf(bindings[a.id]).some((key) => taken.includes(key))) continue;
      return isDefault(b.id, bindings[b.id]) ? a.id : b.id;
    }
  }
  return null;
}

/** Reads saved bindings, falling back to defaults per action for anything unusable. */
export function parseStored(raw: string | null): HotkeyBindings {
  const bindings = defaultBindings();
  if (!raw) return bindings;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return bindings;
  }
  if (typeof parsed !== "object" || parsed === null) return bindings;
  const { v, overrides } = parsed as { v?: unknown; overrides?: unknown };
  if (v !== STORAGE_VERSION || typeof overrides !== "object" || overrides === null) return bindings;

  for (const id of ACTION_IDS) {
    const override = parseOverride((overrides as Record<string, unknown>)[id]);
    if (override) bindings[id] = override;
  }

  // Overrides are checked as a set, not one by one: swapping two actions' keys
  // is valid as a whole even though each half alone would collide.
  for (let guard = ACTION_IDS.length; guard > 0; guard--) {
    const offender = conflictingAction(bindings);
    if (!offender) break;
    bindings[offender] = { ...actionById(offender).defaults };
  }
  return bindings;
}

/** The action a key press triggers on this page, or null. Callers still guard typing targets and IME. */
export function actionForEvent(
  bindings: HotkeyBindings,
  scope: HotkeyScope,
  event: HotkeyEventLike,
): HotkeyActionId | null {
  const key = eventKey(event);
  if (key === null) return null;
  const match = HOTKEY_ACTIONS.find((a) => a.scopes.includes(scope) && keysOf(bindings[a.id]).includes(key));
  return match ? match.id : null;
}

/** Tooltip text for an action's keys, e.g. "Space / S"; empty when unbound. */
export function hotkeyHint(bindings: HotkeyBindings, id: HotkeyActionId): string {
  return keysOf(bindings[id]).map(formatKey).join(" / ");
}
