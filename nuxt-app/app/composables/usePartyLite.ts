import type { StudyFilters } from "~/utils/studyFilters";

// Hand-kept copies of the server's views (server/utils/partyLiteGame.ts), same field order.
export interface LiteAnswer {
  animeTitle: string;
  animeTitleRomaji: string;
  songTitle: string;
  artistName: string;
  themeSlot: string;
  hasCover: boolean;
}

export type LiteScope = { type: "all" } | { type: "artist" | "anime" | "created"; id: number };

export interface LiteHostSong {
  token: string;
  cardId: number;
  manual: boolean;
  kind: "video" | "audio";
  download: "local" | "waiting" | "downloading" | "stream";
  progress: number | null;
  answer: LiteAnswer;
}

export interface LiteHostState {
  version: number;
  current: LiteHostSong | null;
  upNext: LiteHostSong[];
  canGoBack: boolean;
  revealed: boolean;
  playing: boolean;
  played: number;
  source: { scope: LiteScope; label: string | null; filters: StudyFilters | null; endless: boolean };
  matchCount: number;
  position: { token: string; time: number; duration: number | null } | null;
}

export interface LiteDisplayState {
  phase: "idle" | "guessing" | "revealed";
  token: string | null;
  kind: "video" | "audio" | null;
  playing: boolean;
  seekTo: number;
  seekSeq: number;
  played: number;
  answer: LiteAnswer | null;
}

export type LiteCommand =
  | { type: "play" | "pause" | "reveal" | "next" | "previous" | "rerollAll" }
  | { type: "seek"; seconds: number }
  | { type: "remove" | "reroll"; token: string }
  | { type: "add"; cardId: number; position: "next" | "end" }
  | { type: "endless"; enabled: boolean }
  | { type: "source"; scope: LiteScope; label: string | null; filters?: string };

const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 10000;

/** A server-sent view that reconnects with backoff; `onClosed` may veto the retry. */
function useLiteStream<T>(url: string, onClosed?: () => Promise<boolean>) {
  const state = ref<T | null>(null);
  const connected = ref(false);
  let source: EventSource | null = null;
  let retryMs = RETRY_MIN_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    source?.close();
    source = new EventSource(url);
    source.onopen = () => {
      connected.value = true;
      retryMs = RETRY_MIN_MS;
    };
    source.onmessage = (message) => {
      try {
        state.value = JSON.parse(message.data) as T;
      } catch {
        // A malformed frame is skipped; the next change resends everything.
      }
    };
    source.onerror = async () => {
      connected.value = false;
      if (source?.readyState !== EventSource.CLOSED) return;
      if (onClosed && !(await onClosed())) return;
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    };
  }

  onMounted(connect);
  onBeforeUnmount(() => {
    if (retryTimer) clearTimeout(retryTimer);
    source?.close();
  });

  return { state, connected };
}

/** The host's live view of the minimal party game, plus a way to send it commands. */
export function usePartyLiteHost() {
  const sessionLost = ref(false);
  const commandError = ref<string | null>(null);

  // A stream that closes for good is usually an expired login.
  const { state, connected } = useLiteStream<LiteHostState>("/api/party/host/lite/stream", async () => {
    try {
      await $fetch("/api/party/host/ping");
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 401) {
        sessionLost.value = true;
        return false;
      }
    }
    return true;
  });

  async function send(command: LiteCommand): Promise<boolean> {
    commandError.value = null;
    try {
      await $fetch("/api/party/host/lite/command", { method: "POST", body: command });
      return true;
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 401) sessionLost.value = true;
      else commandError.value = extractErrorMessage(err, "That didn't go through.");
      return false;
    }
  }

  return { state, connected, sessionLost, commandError, send };
}

export function usePartyLiteDisplay() {
  return useLiteStream<LiteDisplayState>("/api/party/display/lite/stream");
}
