export interface SelfUpdateStatus {
  state: "unavailable" | "idle" | "downloading" | "verifying" | "unpacking" | "ready" | "failed";
  reason: "not-packaged" | "up-to-date" | "no-asset" | "no-digest" | "not-writable" | "check-failed" | null;
  version: string | null;
  receivedBytes: number;
  totalBytes: number | null;
  error: string | null;
}

const POLL_INTERVAL_MS = 1000;

export function isSelfUpdateRunning(state: SelfUpdateStatus["state"] | undefined): boolean {
  return state === "downloading" || state === "verifying" || state === "unpacking";
}

// Polls only while a job is running. A failed request leaves `status` null,
// which the About panel renders as nothing: the manual link below it still works.
export function useSelfUpdate() {
  const status = ref<SelfUpdateStatus | null>(null);
  const starting = ref(false);
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

  onBeforeUnmount(() => clearTimeout(timer));

  return { status, starting, refresh, start };
}
