import { formatKey, HOTKEY_ACTIONS, normalizeKey, type ApplyResult, type HotkeyAction, type HotkeyScope } from "./hotkeys";

export type CaptureOutcome =
  | { kind: "key"; key: string }
  | { kind: "clear" }
  | { kind: "cancel" }
  | { kind: "rejected"; message: string }
  | { kind: "ignore" };

export interface CaptureEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat?: boolean;
  isComposing?: boolean;
}

// Pressed on their way to a real key, or only ever sent by an IME.
const IGNORED_KEYS: ReadonlySet<string> = new Set([
  "shift", "control", "alt", "altgraph", "meta", "os", "capslock", "fn", "dead", "process", "unidentified",
]);

/** What a key press means while the editor waits for a new key. */
export function captureKey(event: CaptureEvent): CaptureOutcome {
  // A repeat is the Enter or Space that started the capture still being held.
  if (event.repeat || event.isComposing) return { kind: "ignore" };
  const key = normalizeKey(event.key);
  if (key === null || IGNORED_KEYS.has(key)) return { kind: "ignore" };
  if (key === "escape") return { kind: "cancel" };
  if (key === "backspace" || key === "delete") return { kind: "clear" };
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return { kind: "rejected", message: "Plain keys only: hold no Ctrl, Cmd or Alt." };
  }
  return { kind: "key", key };
}

type BindingFailure = Extract<ApplyResult, { ok: false }>;

const labelOf = (id: string) => HOTKEY_ACTIONS.find((a) => a.id === id)?.label ?? id;

/** The sentence shown when a key could not be bound. */
export function describeBindingFailure(failure: BindingFailure, key: string): string {
  const shown = formatKey(key);
  if (failure.reason === "reserved") return `${shown} can't be used: Enter, Escape and Tab keep their usual jobs.`;
  if (failure.reason === "duplicate") return "Primary and alternate must be different keys.";
  return `${shown} is already used by ${labelOf(failure.conflictsWith)}. Change or clear that one first.`;
}

const GROUPS: { label: string; scopes: HotkeyScope[] }[] = [
  { label: "Everywhere", scopes: ["study", "listen", "preview"] },
  { label: "Study and Listen", scopes: ["study", "listen"] },
  { label: "Study only", scopes: ["study"] },
  { label: "Listen only", scopes: ["listen"] },
  { label: "Cards and Preview", scopes: ["preview"] },
];

const sameScopes = (a: HotkeyScope[], b: HotkeyScope[]) => a.length === b.length && a.every((s) => b.includes(s));

/** Every action, grouped by where it works, in the order the screen lists them. */
export function hotkeyGroups(): { label: string; actions: HotkeyAction[] }[] {
  const groups = GROUPS.map((group) => ({
    label: group.label,
    actions: HOTKEY_ACTIONS.filter((a) => sameScopes(a.scopes, group.scopes)),
  }));
  const placed = new Set(groups.flatMap((g) => g.actions.map((a) => a.id)));
  const rest = HOTKEY_ACTIONS.filter((a) => !placed.has(a.id));
  return [...groups, ...(rest.length ? [{ label: "Other pages", actions: rest }] : [])].filter((g) => g.actions.length);
}
