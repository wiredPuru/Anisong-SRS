import { NETWORK_MODE_EVENT, networkModeChanged, networkModeEndpoint, parseNetworkMode, type NetworkMode } from "~/utils/networkMode";

export function useNetworkMode() {
  const offlineMode = useState<NetworkMode>("networkMode", () => null);
  const pending = useState("networkModePending", () => false);
  const canUseRemote = computed(() => offlineMode.value === false);
  const route = useRoute();
  const request = import.meta.server ? useRequestFetch() : $fetch;

  async function refresh(reloadOnChange = true): Promise<void> {
    if (pending.value) return;
    pending.value = true;
    const previous = offlineMode.value;
    try {
      const next = parseNetworkMode(await request<unknown>(networkModeEndpoint(route.path), { cache: "no-store" }));
      offlineMode.value = next;
      if (import.meta.client && reloadOnChange && networkModeChanged(previous, next)) window.location.reload();
    } catch {
      offlineMode.value = null;
    } finally {
      pending.value = false;
    }
  }

  function notifyChanged(): void {
    if (!import.meta.client) return;
    try {
      localStorage.setItem(NETWORK_MODE_EVENT, String(Date.now()));
    } catch {}
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(NETWORK_MODE_EVENT);
      channel.postMessage("changed");
      channel.close();
    }
  }

  return { offlineMode, canUseRemote, pending, refresh, notifyChanged };
}
