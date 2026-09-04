export interface UpdateStatus {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  checkFailed: boolean;
  checkedAt: string;
}

// Shared app-wide state so the rail and the Settings About panel read one
// result instead of each firing their own request on every page load.
export function useUpdateCheck() {
  const status = useState<UpdateStatus | null>("updateStatus", () => null);
  const pending = useState<boolean>("updateStatusPending", () => false);

  async function check(force = false): Promise<void> {
    if (pending.value) return;
    if (status.value && !force) return;

    pending.value = true;
    try {
      status.value = await $fetch<UpdateStatus>("/api/version");
    } catch {
      // The route itself never fails, so this only catches the app being
      // unreachable; treat it the same quiet way the server does.
      status.value = null;
    } finally {
      pending.value = false;
    }
  }

  return { status, pending, check };
}
