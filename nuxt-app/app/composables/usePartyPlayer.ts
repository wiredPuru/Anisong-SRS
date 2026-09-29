// Hand-kept copy of the server's PartyPlayerState (server/utils/partyGame.ts).
export interface PartyPlayerState {
  version: number;
  me: { id: number; name: string; score: number } | null;
  phase: "idle" | "guessing" | "revealed";
  song: { number: number; total: number } | null;
  players: { name: string; score: number }[];
}

export type PartyPlayerView = "checking" | "join" | "joined";

const NAME_KEY = "gaqParty:playerName";
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 10000;

function readStoredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // The name is only a convenience for the next join.
  }
}

/** A phone's side of the party: joining, then following the player stream. */
export function usePartyPlayer() {
  const view = ref<PartyPlayerView>("checking");
  const state = ref<PartyPlayerState | null>(null);
  const connected = ref(false);
  // Why the phone is back at the join form, when it did not choose to be.
  const notice = ref<string | null>(null);
  const savedName = ref("");

  let source: EventSource | null = null;
  let retryMs = RETRY_MIN_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let freshConnection = true;

  function closeStream() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    source?.close();
    source = null;
    connected.value = false;
  }

  function backToJoin(message: string | null) {
    closeStream();
    state.value = null;
    notice.value = message;
    view.value = "join";
  }

  function openStream() {
    closeStream();
    source = new EventSource("/api/party/player/stream");
    freshConnection = true;
    source.onopen = () => {
      connected.value = true;
      retryMs = RETRY_MIN_MS;
    };
    source.onmessage = (message) => {
      let next: PartyPlayerState;
      try {
        next = JSON.parse(message.data) as PartyPlayerState;
      } catch {
        return;
      }
      if (!freshConnection && state.value && next.version < state.value.version) return;
      freshConnection = false;
      if (!next.me) {
        backToJoin("The host removed you from the game.");
        return;
      }
      state.value = next;
    };
    source.onerror = () => {
      connected.value = false;
      if (source?.readyState !== EventSource.CLOSED) return;
      retryTimer = setTimeout(() => void resume(), retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    };
  }

  // A dropped stream is either the network or a party restart, which ends
  // every player session; /me tells the two apart.
  async function resume(): Promise<void> {
    try {
      await $fetch("/api/party/player/me");
      view.value = "joined";
      openStream();
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 401) {
        backToJoin(view.value === "joined" ? "The game restarted. Join again to keep playing." : null);
        return;
      }
      if (view.value === "checking") view.value = "join";
      retryTimer = setTimeout(() => void resume(), retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    }
  }

  async function join(code: string, name: string): Promise<string | null> {
    try {
      const result = await $fetch<{ player: { name: string } }>("/api/party/player/join", {
        method: "POST",
        body: { code, name },
      });
      storeName(result.player.name);
      savedName.value = result.player.name;
      notice.value = null;
      view.value = "joined";
      openStream();
      return null;
    } catch (err) {
      return extractErrorMessage(err, "Could not join. Check you are on the same network.");
    }
  }

  async function rename(name: string): Promise<string | null> {
    try {
      const result = await $fetch<{ name: string }>("/api/party/player/name", { method: "POST", body: { name } });
      storeName(result.name);
      savedName.value = result.name;
      return null;
    } catch (err) {
      return extractErrorMessage(err, "Could not change your name.");
    }
  }

  onMounted(() => {
    savedName.value = readStoredName();
    void resume();
  });
  onBeforeUnmount(closeStream);

  return { view, state, connected, notice, savedName, join, rename };
}
