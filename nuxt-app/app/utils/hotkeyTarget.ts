import type { HotkeyScope } from "./hotkeys";

export const HOTKEY_DIALOG_SELECTOR = '[role="dialog"], [aria-modal="true"], .backdrop';

export interface HotkeyTargetLike {
  tagName: string;
  getAttribute(name: string): string | null;
  closest(selector: string): unknown;
}

const INTERACTIVE_TAGS: ReadonlySet<string> = new Set(["BUTTON", "SUMMARY", "SELECT"]);
const INTERACTIVE_ROLES: ReadonlySet<string> = new Set([
  "button", "checkbox", "switch", "tab", "menuitem", "option", "radio", "link",
]);
const DIALOG_SELECTOR = HOTKEY_DIALOG_SELECTOR;

function isInteractive(target: HotkeyTargetLike): boolean {
  const tag = target.tagName.toUpperCase();
  if (tag === "A") return target.getAttribute("href") !== null;
  if (INTERACTIVE_TAGS.has(tag)) return true;
  const role = target.getAttribute("role");
  return role !== null && INTERACTIVE_ROLES.has(role);
}

/**
 * Whether Space keeps its native job (activating the focused control) instead of
 * acting as the play/pause hotkey. On Study and Listen a clicked Display toggle
 * stays focused, and Space should then pause rather than flip it again; on
 * /cards a table row is a button and Space is how a keyboard user selects it.
 */
export function spaceYieldsToTarget(
  scope: HotkeyScope,
  target: HotkeyTargetLike | null,
  dialogOpen = false,
): boolean {
  if (!target || !isInteractive(target)) return false;
  if (target.closest(DIALOG_SELECTOR) !== null) return true;
  // A control behind an open dialog (the row that opened a Preview, still
  // focused) is not what the person means to press Space on.
  return scope === "preview" && !dialogOpen;
}

/** Whether this key press gives up a typed round, following the pass action's keys. */
export function typedGiveUpApplies(input: {
  passKeys: string[];
  key: string;
  inTextField: boolean;
  caretAtEnd: boolean;
}): boolean {
  if (!input.passKeys.includes(input.key)) return false;
  if (!input.inTextField) return true;
  // A letter bound to Pass is just typing inside a box; only the arrow, with the
  // caret already at the end, has nothing left to move through.
  return input.key === "arrowright" && input.caretAtEnd;
}
