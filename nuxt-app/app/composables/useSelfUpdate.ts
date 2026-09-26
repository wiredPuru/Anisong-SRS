export interface SelfUpdateStatus {
  state: "unavailable" | "idle" | "downloading" | "verifying" | "unpacking" | "ready" | "failed";
  reason: "not-packaged" | "up-to-date" | "no-asset" | "no-digest" | "not-writable" | "check-failed" | null;
  version: string | null;
  receivedBytes: number;
  totalBytes: number | null;
  error: string | null;
}

const POLL_INTERVAL_MS = 1000;
const RESTART_TIMEOUT_MS = 60_000;

export type RestartPhase = "idle" | "restarting" | "timed-out";

export function isSelfUpdateRunning(state: SelfUpdateStatus["state"] | undefined): boolean {
  return state === "downloading" || state === "verifying" || state === "unpacking";
}

// Polls only while a job is running. A failed request leaves `status` null,
// which the About panel renders as nothing: the manual link below it still works.
export function useSelfUpdate() {
  const status = ref<SelfUpdateStatus | null>(null);
  const starting = ref(false);
  const restartPhase = ref<RestartPhase>("idle");
  const restartError = ref<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedulePoll() {
    clearTimeout(timer);
    if (isSelfUpdateRunning(status.value?.state)) {
      timer = setTimeout(refresh, POLL_INTERVAL_MS);
    }
  }

  async function refresh(): Promise<void> {
    try {
      status.value = await $fetch<SelfUpdateStatus>("/api/update/status");
    } catch {
      status.value = null;
    }
    schedulePoll();
  }

  async function start(): Promise<void> {
    if (starting.value) return;
    starting.value = true;
    try {
      status.value = await $fetch<SelfUpdateStatus>("/api/update/download", { method: "POST" });
    } catch {
      status.value = null;
    } finally {
      starting.value = false;
    }
    schedulePoll();
  }

  // The server exits right after answering, and the new build takes a moment
  // to come up on the same port. Reload once it reports a different version.
  function waitForNewVersion(previous: string, deadline: number) {
    timer = setTimeout(async () => {
      try {
        const { current } = await $fetch<{ current: string }>("/api/version");
        if (current !== previous) {
          window.location.reload();
          return;
        }
      } catch {
        // Expected while the old process exits and the new one starts.
      }
      if (Date.now() >= deadline) {
        restartPhase.value = "timed-out";
        return;
      }
      waitForNewVersion(previous, deadline);
    }, POLL_INTERVAL_MS);
  }

  async function restart(): Promise<void> {
    if (restartPhase.value === "restarting") return;
    restartError.value = null;
    restartPhase.value = "restarting";
    const previous = useRuntimeConfig().public.appVersion;
    try {
      const result = await $fetch<{ ok: true } | { ok: false; error: string }>(
        "/api/update/restart",
        { method: "POST" },
      );
      if (!result.ok) {
        restartPhase.value = "idle";
        restartError.value = result.error;
        await refresh();
        return;
      }
    } catch {
      restartPhase.value = "idle";
      restartError.value = "The update could not be installed. Try again.";
      return;
    }
    clearTimeout(timer);
    waitForNewVersion(previous, Date.now() + RESTART_TIMEOUT_MS);
  }

  onBeforeUnmount(() => clearTimeout(timer));

  return { status, starting, restartPhase, restartError, refresh, start, restart };
}
