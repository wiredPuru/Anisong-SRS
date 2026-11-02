import { describe, expect, it } from "vitest";
import type { CardWithDetails } from "../composables/useStudySession";
import { libraryListenTrack, type ListenTrack } from "./listenRequests";
import { clearListenRequests, createListenRequestQueue, currentListenEntry, listenDeckProgress, moveListenQueue, pendingListenRequests, removeListenRequest, requestListenTrack, type ListenRequestQueue } from "./listenRequestQueue";

const track = (id: number): ListenTrack => libraryListenTrack({ id } as CardWithDetails);
const initial = () => createListenRequestQueue([track(1), track(2), track(3)]);
const keys = (queue: ListenRequestQueue) => queue.entries.map((entry) => entry.track.key);
const add = (queue: ListenRequestQueue, id: number, mode: "now" | "next" = "next") => requestListenTrack(queue, track(id), mode).queue;

describe("temporary Listen request queue", () => {
  it("puts FIFO requests before the remaining deck without mutating the original", () => {
    const original = initial();
    const queue = add(add(original, 10), 11);
    expect(keys(queue)).toEqual(["card:1", "card:10", "card:11", "card:2", "card:3"]);
    expect(keys(original)).toEqual(["card:1", "card:2", "card:3"]);
    expect(currentListenEntry(queue)?.track.key).toBe("card:1");
    expect(listenDeckProgress(queue)).toEqual({ played: 1, total: 3 });
  });

  it("plays now, preserves other requests, and returns to the next deck song", () => {
    let queue = add(add(add(initial(), 10), 11), 12, "now");
    expect(currentListenEntry(queue)?.track.key).toBe("card:12");
    const heard: string[] = [];
    while (currentListenEntry(queue)) {
      heard.push(currentListenEntry(queue)!.track.key);
      queue = moveListenQueue(queue, "next");
    }
    expect(heard).toEqual(["card:12", "card:10", "card:11", "card:2", "card:3"]);
    expect(listenDeckProgress(queue)).toEqual({ played: 3, total: 3 });
  });

  it("does not advance the deck again when interrupting a request", () => {
    let queue = add(add(initial(), 10), 11);
    queue = moveListenQueue(queue, "next");
    queue = add(queue, 12, "now");
    expect(keys(queue).slice(queue.index)).toEqual(["card:12", "card:11", "card:2", "card:3"]);
  });

  it("does not duplicate an already queued track", () => {
    const queue = add(initial(), 10);
    const result = requestListenTrack(queue, track(10), "next");
    expect(result.status).toBe("already-queued");
    expect(result.queue).toBe(queue);
  });

  it("moves an existing request into playback without allocating it again", () => {
    const queue = add(add(initial(), 10), 11);
    const waiting = pendingListenRequests(queue)[1]!;
    const moved = add(queue, 11, "now");
    expect(currentListenEntry(moved)?.entryId).toBe(waiting.entryId);
    expect(moved.entries).toHaveLength(queue.entries.length);
    expect(moved.nextEntryId).toBe(queue.nextEntryId);
    expect(keys(moved).slice(moved.index)).toEqual(["card:11", "card:10", "card:2", "card:3"]);
  });

  it("uses a separate occurrence for a song also present in the deck", () => {
    const queue = add(initial(), 2);
    const occurrences = queue.entries.filter((entry) => entry.track.key === "card:2");
    expect(occurrences.map((entry) => entry.origin)).toEqual(["request", "deck"]);
    expect(new Set(occurrences.map((entry) => entry.entryId)).size).toBe(2);
    expect(keys(removeListenRequest(queue, occurrences[0]!.entryId))).toEqual(keys(initial()));
    expect(removeListenRequest(queue, occurrences[1]!.entryId)).toBe(queue);
  });

  it("leaves current and history entries alone when removing or clearing", () => {
    const queued = add(add(initial(), 10), 11);
    const queue = moveListenQueue(queued, "next");
    const current = currentListenEntry(queue)!;
    expect(removeListenRequest(queue, current.entryId)).toBe(queue);
    expect(keys(clearListenRequests(queue))).toEqual(["card:1", "card:10", "card:2", "card:3"]);
  });

  it("restarts the current presentation without creating another occurrence", () => {
    const queue = initial();
    const result = requestListenTrack(queue, track(1), "now");
    expect(result.status).toBe("playing");
    expect(result.queue).toBe(queue);
  });

  it("traverses history and returns forward through the same occurrences", () => {
    let queue = add(initial(), 10);
    queue = moveListenQueue(moveListenQueue(queue, "next"), "next");
    const entries = queue.entries;
    queue = moveListenQueue(queue, "previous");
    expect(currentListenEntry(queue)?.track.key).toBe("card:10");
    queue = moveListenQueue(queue, "next");
    expect(currentListenEntry(queue)?.track.key).toBe("card:2");
    expect(queue.entries).toBe(entries);
  });

  it("prioritizes upcoming requests when requesting while back in history", () => {
    let queue = add(initial(), 10);
    queue = moveListenQueue(moveListenQueue(queue, "next"), "next");
    queue = add(queue, 11);
    queue = moveListenQueue(moveListenQueue(queue, "previous"), "previous");
    queue = add(queue, 12);
    expect(keys(queue)).toEqual(["card:1", "card:10", "card:11", "card:12", "card:2", "card:3"]);
    expect(new Set(queue.entries.map((entry) => entry.entryId)).size).toBe(queue.entries.length);
  });

  it("starts requests on empty and finished playlists", () => {
    const empty = add(createListenRequestQueue(), 10);
    expect(currentListenEntry(empty)?.track.key).toBe("card:10");
    expect(listenDeckProgress(empty)).toEqual({ played: 0, total: 0 });
    let finished = moveListenQueue(createListenRequestQueue([track(1)]), "next");
    finished = add(finished, 10);
    expect(currentListenEntry(finished)?.track.key).toBe("card:10");
    expect(moveListenQueue(finished, "next").finished).toBe(true);
  });

  it("handles bounds, repeat skips, and a new empty reset", () => {
    const queue = createListenRequestQueue([track(1)]);
    expect(moveListenQueue(queue, "previous")).toBe(queue);
    const finished = moveListenQueue(queue, "next");
    expect(moveListenQueue(finished, "next")).toBe(finished);
    expect(currentListenEntry(moveListenQueue(finished, "previous"))?.track.key).toBe("card:1");
    expect(moveListenQueue(createListenRequestQueue(), "next").entries).toEqual([]);
    expect(pendingListenRequests(createListenRequestQueue())).toEqual([]);
  });
});
