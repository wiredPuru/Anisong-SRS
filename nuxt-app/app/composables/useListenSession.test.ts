import { computed, effectScope, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useListenSession } from "./useListenSession";
import type { CardWithDetails, StudyScope } from "./useStudySession";
import { EMPTY_STUDY_FILTERS } from "../utils/studyFilters";
import { libraryListenTrack } from "../utils/listenRequests";

const card = (id: number) => ({ id, songTitle: `Song ${id}`, localVideoPath: `/music/${id}.webm`, localAudioPath: null,
  animethemesVideoUrl: null, animethemesAudioUrl: null } as CardWithDetails);
const scopes: ReturnType<typeof effectScope>[] = [];
const reply = (cards: CardWithDetails[]) => ({ cards, total: cards.length });
const flush = async () => { await Promise.resolve(); await nextTick(); await Promise.resolve(); };
let fetcher: ReturnType<typeof vi.fn>;

function setup(cards = [card(1), card(2), card(3)]) {
  fetcher.mockResolvedValue(reply(cards));
  const scope = effectScope(); scopes.push(scope);
  const source = ref<StudyScope | null>({ type: "all" });
  const filters = ref({ ...EMPTY_STUDY_FILTERS });
  const shuffle = ref(false);
  const session = scope.run(() => useListenSession(computed(() => source.value), filters, shuffle,
    computed(() => false), computed(() => "anisongdb" as const)))!;
  return { session, source, filters, shuffle, scope };
}

beforeEach(() => {
  fetcher = vi.fn();
  vi.stubGlobal("$fetch", fetcher);
  vi.stubGlobal("useNetworkMode", () => ({ canUseRemote: ref(true) }));
});
afterEach(() => { scopes.splice(0).forEach((scope) => scope.stop()); vi.unstubAllGlobals(); });

describe("Listen request session", () => {
  it("continues the same deck after requests without resetting its epoch", async () => {
    const { session } = setup(); await flush();
    const epoch = session.queueKey.value;
    const presentation = session.presentationKey.value;
    expect(session.request(libraryListenTrack(card(10)), "next")).toBe("queued");
    expect(session.presentationKey.value).toBe(presentation);
    expect(session.queueKey.value).toBe(epoch);
    session.next(); expect(session.currentCard.value?.id).toBe(10);
    expect(session.total.value).toBe(3);
    expect(session.deckProgress.value.played).toBe(1);
    session.next(); expect(session.currentCard.value?.id).toBe(2);
    session.previous(); expect(session.currentCard.value?.id).toBe(10);
    expect(session.canGoPrevious.value).toBe(true);
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual(["/api/listen/queue"]);
  });

  it("starts a Play now request and ignores an old end callback", async () => {
    const { session } = setup(); await flush();
    const oldKey = session.presentationKey.value;
    session.request(libraryListenTrack(card(10)), "now");
    expect(session.startOnMount.value).toBe(true);
    session.advance(oldKey);
    expect(session.currentCard.value?.id).toBe(10);
    session.advance(session.presentationKey.value);
    expect(session.currentCard.value?.id).toBe(2);
    expect(session.startOnMount.value).toBe(false);
  });

  it("patches every real-card occurrence, including one outside the base deck", async () => {
    const { session } = setup(); await flush();
    session.request(libraryListenTrack(card(2)), "next");
    session.patchCard(2, { songTitle: "Corrected" });
    session.next(); expect(session.currentLibraryCard.value?.songTitle).toBe("Corrected");
    session.next(); expect(session.currentLibraryCard.value?.songTitle).toBe("Corrected");
    session.request(libraryListenTrack(card(10)), "now");
    session.patchCurrent({ notes: "A note" });
    expect(session.currentLibraryCard.value?.notes).toBe("A note");
  });

  it("rejects old selections and clears requests when the scope changes", async () => {
    const { session, source } = setup(); await flush();
    const epoch = session.queueKey.value;
    session.request(libraryListenTrack(card(10)), "next");
    source.value = { type: "created", id: 3 }; await flush();
    expect(session.pendingRequests.value).toEqual([]);
    expect(session.request(libraryListenTrack(card(11)), "next", epoch)).toBe("stale");
  });

  it("ignores a previous load response and work after disposal", async () => {
    const { session, source, scope } = setup(); await flush();
    let resolveOld!: (result: ReturnType<typeof reply>) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    source.value = { type: "anime", id: 2 }; await nextTick();
    fetcher.mockResolvedValueOnce(reply([card(20)]));
    source.value = { type: "anime", id: 3 }; await flush();
    resolveOld(reply([card(99)])); await flush();
    expect(session.currentCard.value?.id).toBe(20);
    scope.stop();
    expect(session.request(libraryListenTrack(card(10)), "now")).toBe("stale");
  });

  it("allows requests after empty and finished decks", async () => {
    const empty = setup([]).session; await flush();
    expect(empty.request(libraryListenTrack(card(10)), "next")).toBe("playing");
    expect(empty.currentCard.value?.id).toBe(10);
    empty.next(); expect(empty.finished.value).toBe(true);
    const finished = setup([card(1)]).session; await flush();
    finished.next();
    expect(finished.request(libraryListenTrack(card(11)), "next")).toBe("playing");
    finished.next(); expect(finished.finished.value).toBe(true);
  });

  it("keeps source failures within the affected request", async () => {
    const { session } = setup(); await flush();
    expect(session.request(libraryListenTrack({ ...card(10), localVideoPath: null }), "now")).toBe("unavailable");
    expect(session.currentCard.value?.id).toBe(1);
  });
});
