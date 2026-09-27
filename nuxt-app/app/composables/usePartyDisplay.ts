export type PartyPhase = "idle" | "guessing" | "revealed";
export type PartyPicture = "video" | "blackout" | "cover";
export type PartyLightningMode = "regular" | "blind" | "peek" | "cover" | "clues" | "tags" | "title";
export type PartyHints =
  | { kind: "clues"; items: { label: string; value: string }[] }
  | { kind: "tags"; items: string[] }
  | { kind: "title"; masked: string }
  | null;

// Hand-kept copy of the server's PartyEffects (server/utils/partyGame.ts).
export interface PartyEffects {
  blur: number;
  pixelate: number;
  decay: boolean;
  decaySeconds: number;
  muted: boolean;
  picture: PartyPicture;
}

export interface PartyAnswer {
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  songTitle: string;
  artistName: string;
  themeSlot: string;
  coverImageUrl: string | null;
}

export interface PartyTimer {
  seconds: number;
  endsAt: number;
  autoReveal: boolean;
}
export interface PartyPlayer {
  id: number;
  name: string;
  score: number;
}
export interface PartyBanner {
  text: string;
  shownAt: number;
}
export interface PartyMusic {
  enabled: boolean;
  volume: number;
}

export interface PartyDisplayState {
  version: number;
  phase: PartyPhase;
  item: { token: string; kind: "video" | "audio"; number: number; total: number } | null;
  playing: boolean;
  startAt: number;
  seekTo: number | null;
  seekSeq: number;
  startFraction: number;
  effects: PartyEffects;
  lightning: { mode: PartyLightningMode; guessSeconds: number; hints: PartyHints } | null;
  timer: PartyTimer | null;
  scoreboard: PartyPlayer[] | null;
  banner: PartyBanner | null;
  music: PartyMusic;
  answer: PartyAnswer | null;
}

export interface PartyPositionReport {
  token: string;
  currentTime: number;
  duration: number | null;
  playing: boolean;
  elapsed: number;
}

const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 10000;

/** Follows the party server's display stream; the page never decides what plays. */
export function usePartyDisplay() {
  const state = ref<PartyDisplayState | null>(null);
  const connected = ref(false);

  let source: EventSource | null = null;
  let retryMs = RETRY_MIN_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  // A restarted server counts versions from 0 again, so the first message on
  // each connection is taken as-is; later ones must not go backwards.
  let freshConnection = true;

  function connect() {
    source?.close();
    source = new EventSource("/api/party/display/stream");
    freshConnection = true;
    source.onopen = () => {
      connected.value = true;
      retryMs = RETRY_MIN_MS;
    };
    source.onmessage = (message) => {
      let next: PartyDisplayState;
      try {
        next = JSON.parse(message.data) as PartyDisplayState;
      } catch {
        return;
      }
      if (!freshConnection && state.value && next.version < state.value.version) return;
      freshConnection = false;
      state.value = next;
    };
    source.onerror = () => {
      connected.value = false;
      // EventSource retries a dropped connection itself; it gives up only
      // once closed, which is when this takes over, backing off to 10s.
      if (source?.readyState !== EventSource.CLOSED) return;
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    };
  }

  function disconnect() {
    if (retryTimer) clearTimeout(retryTimer);
    source?.close();
    source = null;
    connected.value = false;
  }

  async function reportPosition(report: PartyPositionReport) {
    await $fetch("/api/party/display/position", { method: "POST", body: report }).catch(() => {});
  }

  onBeforeUnmount(disconnect);

  return { state, connected, connect, reportPosition };
}
