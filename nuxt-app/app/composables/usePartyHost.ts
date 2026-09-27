import type {
  PartyAnswer,
  PartyBanner,
  PartyEffects,
  PartyLightningMode,
  PartyMusic,
  PartyPhase,
  PartyPlayer,
  PartyPositionReport,
  PartyTimer,
} from "./usePartyDisplay";

export interface PartyLightning {
  mode: PartyLightningMode;
  guessSeconds: number;
  revealSeconds: number;
}

// Hand-kept copy of the server's PartyHostState (server/utils/partyGame.ts).
export interface PartyHostState {
  version: number;
  phase: PartyPhase;
  index: number;
  playing: boolean;
  queue: { cardId: number; kind: "video" | "audio"; answer: PartyAnswer }[];
  position: PartyPositionReport | null;
  randomStart: boolean;
  effects: PartyEffects;
  nextEffects: PartyEffects | null;
  lightning: PartyLightning | null;
  timer: PartyTimer | null;
  scoreboard: { players: PartyPlayer[]; visible: boolean };
  banner: PartyBanner | null;
  music: PartyMusic;
}

export type PartyHostCommand =
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; seconds: number }
  | { type: "next" }
  | { type: "previous" }
  | { type: "reveal" }
  | { type: "clear" }
  | { type: "jump"; index: number }
  | { type: "settings"; randomStart: boolean }
  | { type: "effects"; target: "current" | "next"; effects: PartyEffects | null }
  | { type: "lightning"; config: PartyLightning | null }
  | { type: "timer"; seconds: number; autoReveal: boolean }
  | { type: "timerStop" }
  | { type: "score"; op: "add"; name: string }
  | { type: "score"; op: "rename"; id: number; name: string }
  | { type: "score"; op: "remove"; id: number }
  | { type: "score"; op: "adjust"; id: number; delta: number }
  | { type: "score"; op: "reset" }
  | { type: "score"; op: "show"; visible: boolean }
  | { type: "banner"; text: string | null }
  | { type: "music"; enabled: boolean; volume: number };

const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 10000;

/** The host's live view of the game, plus a way to send it commands. */
export function usePartyHost() {
  const state = ref<PartyHostState | null>(null);
  const connected = ref(false);
  const sessionLost = ref(false);
  const commandError = ref<string | null>(null);

  let source: EventSource | null = null;
  let retryMs = RETRY_MIN_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  async function sessionStillValid(): Promise<boolean> {
    try {
      await $fetch("/api/party/host/ping");
      return true;
    } catch (err) {
      return (err as { statusCode?: number }).statusCode !== 401;
    }
  }

  function connect() {
    source?.close();
    source = new EventSource("/api/party/host/stream");
    source.onopen = () => {
      connected.value = true;
      retryMs = RETRY_MIN_MS;
    };
    source.onmessage = (message) => {
      try {
        state.value = JSON.parse(message.data) as PartyHostState;
      } catch {
        // A malformed frame is skipped; the next change resends everything.
      }
    };
    source.onerror = async () => {
      connected.value = false;
      if (source?.readyState !== EventSource.CLOSED) return;
      // A stream that closes for good is usually an expired login (the
      // server restarted, or the password changed).
      if (!(await sessionStillValid())) {
        sessionLost.value = true;
        return;
      }
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    };
  }

  async function send(command: PartyHostCommand) {
    commandError.value = null;
    try {
      await $fetch("/api/party/host/command", { method: "POST", body: command });
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 401) sessionLost.value = true;
      else commandError.value = extractErrorMessage(err, "That command didn't go through.");
    }
  }

  onMounted(connect);
  onBeforeUnmount(() => {
    if (retryTimer) clearTimeout(retryTimer);
    source?.close();
  });

  return { state, connected, sessionLost, commandError, send };
}
