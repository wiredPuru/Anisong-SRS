import { describe, expect, it } from "vitest";
import {
  applyPartyCommand,
  initialPartyState,
  parsePartyCommand,
  scoreRows,
  toDisplayState,
  toPlayerState,
  toQueueItem,
  type PartyCommand,
  type PartyGameState,
} from "./partyGame.ts";

const clip = { kind: "video" as const, source: { type: "remote" as const, url: "https://naedist.animemusicquiz.com/a.webm" } };
const card = { id: 1, songId: 1, localVideoPath: null, localAudioPath: null, animethemesVideoUrl: null, animethemesAudioUrl: null,
  box: 1, streak: 0, nextReviewAt: new Date(), createdAt: new Date(), songTitle: "S", songTitleNative: "S", themeSlot: "OP1",
  artistId: 1, artistName: "A", animeId: 1, animeTitleEnglish: "Show", animeTitleRomaji: "Show", animeTitleNative: "Show",
  animeCoverImageUrl: null } as never;

function run(state: PartyGameState, ...commands: PartyCommand[]): PartyGameState {
  return commands.reduce((current, command) => applyPartyCommand(current, command), state);
}

function game(): PartyGameState {
  const start = run(
    initialPartyState(),
    { type: "score", op: "add", name: "Aki" },
    { type: "score", op: "add", name: "Bea" },
  );
  return applyPartyCommand(start, { type: "load", cardIds: [1] }, { loaded: [toQueueItem(card, clip, "t1"), toQueueItem(card, clip, "t2")] });
}

const score = (state: PartyGameState, id: number) => state.scoreboard.players.find((p) => p.id === id)!.score;

describe("stakes", () => {
  it("doubles an award for the challenged player only, and takes back exactly that", () => {
    const staked = run(game(), { type: "stake", config: { multiplier: 2, risk: false, playerId: 1 } });
    const awarded = run(staked, { type: "award", playerId: 1, awarded: true }, { type: "award", playerId: 2, awarded: true });
    expect(score(awarded, 1)).toBe(2);
    expect(score(awarded, 2)).toBe(1);
    expect(awarded.roundPoints).toEqual({ 1: 2, 2: 1 });

    const changed = run(awarded, { type: "stake", config: null }, { type: "award", playerId: 1, awarded: false });
    expect(score(changed, 1)).toBe(0);
  });

  it("applies to whoever scores when no player is named", () => {
    const awarded = run(game(), { type: "stake", config: { multiplier: 4, risk: true, playerId: null } }, { type: "award", playerId: 2, awarded: true });
    expect(score(awarded, 2)).toBe(4);
  });

  it("scores a correct buzz at the multiple", () => {
    const state = run(
      game(),
      { type: "buzzer", enabled: true },
      { type: "stake", config: { multiplier: 3, risk: true, playerId: 1 } },
      { type: "play" },
    );
    const buzzed = applyPartyCommand(state, { type: "buzz", playerId: 1 });
    expect(score(applyPartyCommand(buzzed, { type: "buzzJudge", correct: true }), 1)).toBe(3);
  });

  it("charges the same multiple for a wrong buzz under Hyper Risk, but not for a plain challenge", () => {
    const buzz = (risk: boolean, playerId: number) => {
      const state = run(game(), { type: "buzzer", enabled: true }, { type: "stake", config: { multiplier: 3, risk, playerId: 1 } }, { type: "play" });
      return applyPartyCommand(applyPartyCommand(state, { type: "buzz", playerId }), { type: "buzzJudge", correct: false });
    };
    expect(score(buzz(true, 1), 1)).toBe(-3);
    expect(score(buzz(false, 1), 1)).toBe(0);
    expect(score(buzz(true, 2), 2)).toBe(0);
  });

  it("clears on the next song and shows only the player's name on the display", () => {
    const staked = run(game(), { type: "stake", config: { multiplier: 2, risk: false, playerId: 1 } });
    expect(toDisplayState(staked).stake).toEqual({ multiplier: 2, risk: false, player: "Aki" });
    expect(run(staked, { type: "next" }).stake).toBeNull();
  });

  it("rejects a bad multiplier", () => {
    expect(parsePartyCommand({ type: "stake", config: { multiplier: 5, risk: false, playerId: null } })).toHaveProperty("error");
    expect(parsePartyCommand({ type: "stake", config: { multiplier: 2, risk: false, playerId: null } })).toHaveProperty("type", "stake");
  });
});

describe("teams", () => {
  it("sums members under a team and lists unteamed players alone", () => {
    const state = run(
      initialPartyState(),
      { type: "score", op: "add", name: "Aki" },
      { type: "score", op: "add", name: "Bea" },
      { type: "score", op: "add", name: "Cid" },
      { type: "score", op: "teamAdd", name: "Reds" },
      { type: "score", op: "assign", id: 1, teamId: 1 },
      { type: "score", op: "assign", id: 2, teamId: 1 },
      { type: "score", op: "adjust", id: 1, delta: 2 },
      { type: "score", op: "adjust", id: 2, delta: 3 },
      { type: "score", op: "adjust", id: 3, delta: 4 },
    );
    expect(scoreRows(state)).toEqual([
      { id: -1, name: "Reds", score: 5, members: ["Aki", "Bea"] },
      { id: 3, name: "Cid", score: 4 },
    ]);
  });

  it("frees members when a team is removed, and ignores duplicate names and unknown teams", () => {
    const base = run(
      initialPartyState(),
      { type: "score", op: "add", name: "Aki" },
      { type: "score", op: "teamAdd", name: "Reds" },
      { type: "score", op: "assign", id: 1, teamId: 1 },
    );
    expect(applyPartyCommand(base, { type: "score", op: "teamAdd", name: "reds" })).toBe(base);
    expect(applyPartyCommand(base, { type: "score", op: "assign", id: 1, teamId: 9 })).toBe(base);
    const removed = applyPartyCommand(base, { type: "score", op: "teamRemove", id: 1 });
    expect(removed.scoreboard.players[0]!.teamId).toBeNull();
    expect(scoreRows(removed).map((row) => row.name)).toEqual(["Aki"]);
  });
});

describe("multiple choice answers", () => {
  const withChoices = () =>
    applyPartyCommand(game(), { type: "choices", enabled: true }, { choices: ["Other", "Show", "Third", "Fourth"] });

  it("records one pick per player and rejects late or out-of-range ones", () => {
    const first = applyPartyCommand(withChoices(), { type: "choicePick", playerId: 1, index: 0 });
    expect(first.choicePicks).toEqual({ 1: 0 });
    expect(applyPartyCommand(first, { type: "choicePick", playerId: 1, index: 1 })).toBe(first);
    expect(applyPartyCommand(withChoices(), { type: "choicePick", playerId: 1, index: 9 }).choicePicks).toEqual({});
  });

  it("awards everyone who picked the right title when the song is revealed, at the stake's multiple", () => {
    const picked = run(
      withChoices(),
      { type: "stake", config: { multiplier: 2, risk: false, playerId: 1 } },
    );
    const answered = applyPartyCommand(applyPartyCommand(picked, { type: "choicePick", playerId: 1, index: 1 }), { type: "choicePick", playerId: 2, index: 1 });
    const revealed = applyPartyCommand(answered, { type: "reveal" });
    expect(score(revealed, 1)).toBe(2);
    expect(score(revealed, 2)).toBe(1);
  });

  it("scores nothing for a wrong pick and hides the right option from phones until the reveal", () => {
    const answered = applyPartyCommand(withChoices(), { type: "choicePick", playerId: 1, index: 0 });
    const revealed = applyPartyCommand(answered, { type: "reveal" });
    expect(score(revealed, 1)).toBe(0);
    expect(toPlayerState(answered, 1).choices).toEqual({ options: ["Other", "Show", "Third", "Fourth"], picked: 0, correct: null });
    expect(toPlayerState(revealed, 1).choices?.correct).toBe(1);
  });

  it("clears the picks when the song changes", () => {
    const answered = applyPartyCommand(withChoices(), { type: "choicePick", playerId: 1, index: 0 });
    expect(applyPartyCommand(answered, { type: "next" }).choicePicks).toEqual({});
  });
});
