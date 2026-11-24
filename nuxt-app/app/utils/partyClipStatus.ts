import type { PartyClipStatus } from "~/composables/usePartyHost";

export type QueueClipStatusKey = PartyClipStatus | "waiting";

const STATUS: Record<QueueClipStatusKey, { mark: string; label: string }> = {
  ready: { mark: "✓", label: "Downloaded and ready to play" },
  fetching: { mark: "⏳", label: "Downloading this song" },
  failed: { mark: "⚠", label: "This song failed to load" },
  noSource: { mark: "⚠", label: "No other source found for this song" },
  waiting: { mark: "○", label: "Not downloaded yet; it downloads when it is a few songs away" },
};

/**
 * The icon a host queue row shows. A song the server has not looked at yet is
 * ready when it is a library file, else still waiting to download.
 */
export function queueClipStatus(item: { status: PartyClipStatus | null; origin: "local" | "stream" }): { key: QueueClipStatusKey; mark: string; label: string } {
  const key: QueueClipStatusKey = item.status ?? (item.origin === "local" ? "ready" : "waiting");
  const label = key === "ready" && item.origin === "local" ? "Downloaded to your library" : STATUS[key].label;
  return { key, mark: STATUS[key].mark, label };
}
