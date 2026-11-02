import type { ListenQueueEntry, ListenTrack } from "./listenRequests";

export interface ListenRequestQueue {
  entries: ListenQueueEntry[];
  index: number;
  finished: boolean;
  nextEntryId: number;
}

export function createListenRequestQueue(tracks: ListenTrack[] = []): ListenRequestQueue {
  return {
    entries: tracks.map((track, i) => ({ entryId: i + 1, origin: "deck", track })),
    index: 0, finished: false, nextEntryId: tracks.length + 1,
  };
}

export function currentListenEntry(queue: ListenRequestQueue): ListenQueueEntry | null {
  return queue.finished ? null : (queue.entries[queue.index] ?? null);
}

export function pendingListenRequests(queue: ListenRequestQueue): ListenQueueEntry[] {
  return queue.finished ? [] : queue.entries.slice(queue.index + 1).filter((entry) => entry.origin === "request");
}

export function moveListenQueue(queue: ListenRequestQueue, direction: "next" | "previous"): ListenRequestQueue {
  if (!queue.entries.length) return queue;
  if (direction === "previous") {
    if (queue.finished) return { ...queue, finished: false };
    return queue.index === 0 ? queue : { ...queue, index: queue.index - 1 };
  }
  if (queue.finished) return queue;
  return queue.index + 1 === queue.entries.length
    ? { ...queue, finished: true } : { ...queue, index: queue.index + 1 };
}

export function requestListenTrack(queue: ListenRequestQueue, track: ListenTrack, mode: "now" | "next"):
  { queue: ListenRequestQueue; status: "playing" | "queued" | "already-queued" } {
  const current = currentListenEntry(queue);
  if (mode === "now" && current?.track.key === track.key) return { queue, status: "playing" };
  const prefix = current ? queue.entries.slice(0, queue.index + 1) : queue.entries;
  const suffix = current ? queue.entries.slice(queue.index + 1) : [];
  const pending = suffix.filter((entry) => entry.origin === "request");
  const existing = pending.find((entry) => entry.track.key === track.key);
  if (mode === "next" && existing) return { queue, status: "already-queued" };
  const entry = existing ?? { entryId: queue.nextEntryId, origin: "request" as const, track };
  const requests = pending.filter((item) => item.entryId !== entry.entryId);
  const start = mode === "now" || !current;
  const upcoming = start ? [entry, ...requests] : [...requests, entry];
  return {
    queue: {
      entries: [...prefix, ...upcoming, ...suffix.filter((item) => item.origin === "deck")],
      index: start ? prefix.length : queue.index,
      finished: false,
      nextEntryId: queue.nextEntryId + (existing ? 0 : 1),
    },
    status: start ? "playing" : "queued",
  };
}

export function removeListenRequest(queue: ListenRequestQueue, entryId: number): ListenRequestQueue {
  const entries = queue.entries.filter((entry, i) => i <= queue.index || entry.origin !== "request" || entry.entryId !== entryId);
  return entries.length === queue.entries.length ? queue : { ...queue, entries };
}

export function clearListenRequests(queue: ListenRequestQueue): ListenRequestQueue {
  const entries = queue.entries.filter((entry, i) => i <= queue.index || entry.origin !== "request");
  return entries.length === queue.entries.length ? queue : { ...queue, entries };
}

export function listenDeckProgress(queue: ListenRequestQueue): { played: number; total: number } {
  return {
    played: queue.entries.slice(0, queue.index + 1).filter((entry) => entry.origin === "deck").length,
    total: queue.entries.filter((entry) => entry.origin === "deck").length,
  };
}
