import type { PartyHostCommand, PartyHostState } from "./usePartyHost";

export const PARTY_HOTKEYS: { keys: string; action: string }[] = [
  { keys: "Space", action: "Play / pause" },
  { keys: "R", action: "Reveal" },
  { keys: "N or →", action: "Next song" },
  { keys: "P or ←", action: "Previous song" },
  { keys: "M", action: "Mute / unmute" },
  { keys: "T", action: "Start a 15s timer" },
  { keys: "S", action: "Show / hide the scoreboard" },
  { keys: "?", action: "This list" },
];

const TIMER_HOTKEY_SECONDS = 15;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  // A checkbox, radio, or range keeps focus after a click, and Space on it
  // should still play/pause; only text-like inputs swallow keys.
  return target instanceof HTMLInputElement && !["checkbox", "radio", "range", "button"].includes(target.type);
}

/** Keyboard control of the host panel, ignored while a text field has focus. */
export function usePartyHotkeys(
  state: Ref<PartyHostState | null>,
  send: (command: PartyHostCommand) => void,
  toggleHelp: () => void,
) {
  function onKeydown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing || isTyping(event.target)) return;
    if (event.key === "?") {
      toggleHelp();
      event.preventDefault();
      return;
    }
    const current = state.value;
    if (!current) return;
    const hasGame = current.index >= 0 && current.queue.length > 0;
    const key = event.key.toLowerCase();

    let command: PartyHostCommand | null = null;
    if (key === " " && hasGame) command = { type: current.playing ? "pause" : "play" };
    else if (key === "r" && hasGame) command = { type: "reveal" };
    else if ((key === "n" || key === "arrowright") && hasGame) command = { type: "next" };
    else if ((key === "p" || key === "arrowleft") && hasGame) command = { type: "previous" };
    else if (key === "m") command = { type: "effects", target: "current", effects: { ...current.effects, muted: !current.effects.muted } };
    else if (key === "t" && hasGame) command = { type: "timer", seconds: TIMER_HOTKEY_SECONDS, autoReveal: true };
    else if (key === "s") command = { type: "score", op: "show", visible: !current.scoreboard.visible };
    if (!command) return;

    event.preventDefault();
    send(command);
  }

  onMounted(() => window.addEventListener("keydown", onKeydown));
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
}
