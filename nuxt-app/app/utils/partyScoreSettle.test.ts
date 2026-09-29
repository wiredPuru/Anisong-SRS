import { describe, expect, it } from "vitest";
import type { PartyPlayer, PartyRoundPoint } from "~/composables/usePartyDisplay";
import { needsSettle, type PartyScoreView, scorePops } from "./partyScoreSettle";

const player = (id: number, name: string, score: number): PartyPlayer => ({ id, name, score, phone: true, connected: true });

function view(token: string | null, points: Record<string, number>, board: PartyPlayer[] | null = null): PartyScoreView {
  const names = ["", "Mika", "Ren", "Yui"];
  const roundPoints: PartyRoundPoint[] = Object.entries(points).map(([id, pts]) => ({ id: Number(id), name: names[Number(id)]!, points: pts }));
  return { token, roundPoints, scoreboard: board };
}

describe("needsSettle", () => {
  it("waits on a round or score change within one song", () => {
    expect(needsSettle(view("t1", {}), view("t1", { 1: 1 }))).toBe(true);
    const board = [player(1, "Mika", 3)];
    expect(needsSettle(view(null, {}, board), view(null, {}, [player(1, "Mika", 4)]))).toBe(true);
  });

  it("shows a new song, a show/hide, or a rename at once", () => {
    expect(needsSettle(view("t1", { 1: 2 }), view("t2", {}))).toBe(false);
    const board = [player(1, "Mika", 3)];
    expect(needsSettle(view("t1", {}, null), view("t1", {}, board))).toBe(false);
    expect(needsSettle(view("t1", {}, board), view("t1", {}, null))).toBe(false);
    expect(needsSettle(view("t1", {}, board), view("t1", {}, [player(1, "Mikaela", 3)]))).toBe(false);
    expect(needsSettle(view("t1", {}, board), view("t1", {}, [...board, player(2, "Ren", 0)]))).toBe(false);
  });
});

describe("scorePops", () => {
  it("turns four +1s into one +4", () => {
    expect(scorePops(view("t1", {}), view("t1", { 1: 4 }))).toEqual([{ id: 1, name: "Mika", points: 4 }]);
  });

  it("pops only the rise, per player", () => {
    expect(scorePops(view("t1", { 1: 1 }), view("t1", { 1: 3, 2: 1 }))).toEqual([
      { id: 1, name: "Mika", points: 2 },
      { id: 2, name: "Ren", points: 1 },
    ]);
  });

  it("pops nothing for a take-back, a net zero, or a reset", () => {
    expect(scorePops(view("t1", { 1: 2 }), view("t1", { 1: 1 }))).toEqual([]);
    expect(scorePops(view("t1", {}), view("t1", {}))).toEqual([]);
    expect(scorePops(view("t1", { 1: 2, 2: 1 }), view("t1", {}))).toEqual([]);
  });

  it("pops nothing across songs", () => {
    expect(scorePops(view("t1", {}), view("t2", { 1: 1 }))).toEqual([]);
  });
});
