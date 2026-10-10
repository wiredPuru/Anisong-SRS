import { describe, expect, it } from "vitest";
import { selectDownloadTargets, withLocalClip } from "./partyDownload.ts";
import { initialPartyState, type PartyGameState, type PartyQueueItem } from "./partyGame.ts";

function item(cardId: number, token: string, remote = true): PartyQueueItem {
  return {
    token,
    cardId,
    clip: { kind: "audio", source: remote ? { type: "remote", url: `https://x/${token}.mp3` } : { type: "local", path: `/l/${token}.mp3` } },
    details: {} as PartyQueueItem["details"],
    answer: {} as PartyQueueItem["answer"],
  };
}

function stateWith(queue: PartyQueueItem[], index: number): PartyGameState {
  return { ...initialPartyState(), queue, index };
}

describe("selectDownloadTargets", () => {
  it("picks upcoming remote catalog songs only", () => {
    const s = stateWith([item(-1, "a"), item(-2, "b"), item(5, "c"), item(-3, "d", false), item(-4, "e"), item(-5, "f")], 0);
    expect(selectDownloadTargets(s, new Set()).map((i) => i.token)).toEqual(["b"]);
    expect(selectDownloadTargets(s, new Set(), 5).map((i) => i.token)).toEqual(["b", "e", "f"]);
  });

  it("skips attempted songs and the current one", () => {
    const s = stateWith([item(-1, "a"), item(-2, "b")], 0);
    expect(selectDownloadTargets(s, new Set(["b"]))).toEqual([]);
    expect(selectDownloadTargets(stateWith([item(-1, "a")], 0), new Set())).toEqual([]);
  });

  it("starts from the first song before a game begins", () => {
    expect(selectDownloadTargets(stateWith([item(-1, "a")], -1), new Set()).map((i) => i.token)).toEqual(["a"]);
  });
});

describe("withLocalClip", () => {
  const local = { kind: "audio", source: { type: "local", path: "/l/b.mp3" } } as const;

  it("swaps an upcoming song's clip", () => {
    const s = stateWith([item(-1, "a"), item(-2, "b")], 0);
    expect(withLocalClip(s, "b", local).queue[1]!.clip).toEqual(local);
  });

  it("leaves the current, past and unknown songs alone", () => {
    const s = stateWith([item(-1, "a"), item(-2, "b")], 1);
    expect(withLocalClip(s, "b", local)).toBe(s);
    expect(withLocalClip(s, "a", local)).toBe(s);
    expect(withLocalClip(s, "zzz", local)).toBe(s);
  });
});
