import type { PartyHostCommand, PartyHostState } from "./usePartyHost";
import { DEFAULT_HIDING_PICTURE } from "~/utils/partyPicture";
import { buildHostAction, hostActionForKey, type HostActionContext } from "~/utils/partyHostActions";
import { parsePreviewLead } from "~/utils/partyPreview";

export const PARTY_HOTKEYS: { keys: string; action: string }[] = [
  { keys: "Space", action: "Play / pause" },
  { keys: "R", action: "Reveal" },
  { keys: "N or →", action: "Next song" },
  { keys: "P or ←", action: "Previous song" },
  { keys: "E", action: "Skip to the last 3 seconds" },
  { keys: "M", action: "Mute / unmute" },
  { keys: "C", action: "Censor the whole screen / lift the censor" },
  { keys: "D", action: "Delete the picked censor box, or all of them" },
  { keys: "B", action: "Blur on / off" },
  { keys: "X", action: "Pixelate on / off" },
  { keys: "V", action: "Hide / show the picture (Bubbles or Music player)" },
  { keys: "T", action: "Start a 15s timer" },
  { keys: "S", action: "Show / hide the scoreboard" },
  { keys: "1-4", action: "Round, Screen, Players, New game tabs" },
  { keys: "Ctrl/⌘+P", action: "Command bar" },
  { keys: "?", action: "This list" },
];

function storedPreviewLead(): number {
  try {
    return parsePreviewLead(localStorage.getItem("gaqSrs:partyPreviewLead"));
  } catch {
    return 0;
  }
}

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
  selectTab: (index: number) => void = () => {},
) {
  const context: HostActionContext = { lastHidingPicture: DEFAULT_HIDING_PICTURE, previewLead: 0 };

  /** The context hotkeys build with, shared so the command bar's V follows the same hiding picture. */
  function actionContext(): HostActionContext {
    context.previewLead = storedPreviewLead();
    return context;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing || isTyping(event.target)) return;
    if (event.key === "?") {
      toggleHelp();
      event.preventDefault();
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      selectTab(Number(event.key) - 1);
      event.preventDefault();
      return;
    }
    const action = hostActionForKey(event.key);
    if (!action) return;
    const command = buildHostAction(action, state.value, actionContext());
    if (!command) return;

    event.preventDefault();
    send(command);
  }

  onMounted(() => window.addEventListener("keydown", onKeydown));
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

  return { actionContext };
}
