import { NETWORK_MODE_EVENT } from "~/utils/networkMode";

export default defineNuxtPlugin(async () => {
  const network = useNetworkMode();
  await network.refresh(false);
  if (!import.meta.client) return;

  const refreshVisible = () => {
    if (document.visibilityState === "visible") void network.refresh();
  };
  document.addEventListener("visibilitychange", refreshVisible);
  window.addEventListener("storage", (event) => {
    if (event.key === NETWORK_MODE_EVENT) void network.refresh();
  });
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(NETWORK_MODE_EVENT);
    channel.addEventListener("message", () => void network.refresh());
  }
  setInterval(refreshVisible, 5000);
});
