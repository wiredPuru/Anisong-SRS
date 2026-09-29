import { describe, expect, it } from "vitest";
import { createLoginLimiter } from "./partyAuth.ts";
import { applyPartyCommand, initialPartyState, type PartyGameState } from "./partyGame.ts";
import { ROOM_CODE_LENGTH, createPlayerRegistry, generateRoomCode, roomCodeMatches } from "./partyPlayers.ts";

function setup(codeIndexes: number[] = [0, 1, 2, 3]) {
  let state: PartyGameState = initialPartyState();
  let next = 0;
  const registry = createPlayerRegistry({
    getPlayers: () => state.scoreboard.players,
    apply: (command) => {
      state = applyPartyCommand(state, command);
    },
    pickCode: () => codeIndexes[next++ % codeIndexes.length]!,
    limiter: createLoginLimiter(3, 60_000),
  });
  return {
    registry,
    get state() {
      return state;
    },
    host(command: Parameters<typeof applyPartyCommand>[1]) {
      state = applyPartyCommand(state, command);
    },
  };
}

const IP = "192.168.1.9";

describe("room codes", () => {
  it("makes codes of four letters without I, L, or O", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(new RegExp(`^[A-Z]{${ROOM_CODE_LENGTH}}$`));
      expect(code).not.toMatch(/[ILO]/);
    }
  });

  it("matches ignoring case and surrounding spaces", () => {
    expect(roomCodeMatches("ABCD", " abcd ")).toBe(true);
    expect(roomCodeMatches("ABCD", "ABCE")).toBe(false);
    expect(roomCodeMatches("ABCD", 1234)).toBe(false);
  });
});

describe("createPlayerRegistry", () => {
  it("joins with the right code and signs the phone in", () => {
    const game = setup();
    const result = game.registry.join({ code: "abcd", name: "  Aki ", ip: IP });
    expect(result).toMatchObject({ ok: true, player: { id: 1, name: "Aki", phone: true } });
    if (!result.ok) return;
    expect(game.registry.playerFor(result.token)?.id).toBe(1);
  });

  it("counts wrong codes and blocks the address after the limit", () => {
    const game = setup();
    for (let i = 0; i < 3; i++) {
      expect(game.registry.join({ code: "ZZZZ", name: "Aki", ip: IP })).toMatchObject({ ok: false, status: 401 });
    }
    expect(game.registry.join({ code: "ABCD", name: "Aki", ip: IP })).toMatchObject({ ok: false, status: 429 });
    expect(game.registry.join({ code: "ABCD", name: "Aki", ip: "192.168.1.10" })).toMatchObject({ ok: true });
  });

  it("gives a phone with a live session its own player back instead of a second one", () => {
    const game = setup();
    const first = game.registry.join({ code: "ABCD", name: "Aki", ip: IP });
    if (!first.ok) throw new Error("join failed");
    const again = game.registry.join({ code: "WRONG", name: "Other", token: first.token, ip: IP });
    expect(again).toMatchObject({ ok: true, token: first.token, player: { id: 1, name: "Aki" } });
    expect(game.state.scoreboard.players).toHaveLength(1);
  });

  it("claims a host-added player and keeps its score", () => {
    const game = setup();
    game.host({ type: "score", op: "add", name: "Bea" });
    game.host({ type: "score", op: "adjust", id: 1, delta: 4 });
    expect(game.registry.join({ code: "ABCD", name: "bea", ip: IP })).toMatchObject({ ok: true, player: { id: 1, score: 4, phone: true } });
  });

  it("refuses a name a connected phone holds, and moves a disconnected one to the new phone", () => {
    const game = setup();
    const first = game.registry.join({ code: "ABCD", name: "Aki", ip: IP });
    if (!first.ok) throw new Error("join failed");
    game.registry.streamOpened(1);
    expect(game.registry.join({ code: "ABCD", name: "AKI", ip: "10.0.0.2" })).toMatchObject({ ok: false, status: 409 });

    game.registry.streamClosed(1);
    const second = game.registry.join({ code: "ABCD", name: "AKI", ip: "10.0.0.2" });
    expect(second).toMatchObject({ ok: true, player: { id: 1 } });
    expect(game.registry.playerFor(first.token)).toBeNull();
  });

  it("refuses a full game and an invalid name", () => {
    const game = setup();
    for (let i = 1; i <= 20; i++) game.host({ type: "score", op: "add", name: `P${i}` });
    expect(game.registry.join({ code: "ABCD", name: "New", ip: IP })).toMatchObject({ ok: false, status: 409, message: "The game is full." });
    expect(game.registry.join({ code: "ABCD", name: "", ip: IP })).toMatchObject({ ok: false, status: 400 });
  });

  it("signs a phone out once the host removes its player", () => {
    const game = setup();
    const joined = game.registry.join({ code: "ABCD", name: "Aki", ip: IP });
    if (!joined.ok) throw new Error("join failed");
    game.host({ type: "score", op: "remove", id: 1 });
    expect(game.registry.playerFor(joined.token)).toBeNull();
  });

  it("keeps a player connected until the last of its streams closes", () => {
    const game = setup();
    game.registry.join({ code: "ABCD", name: "Aki", ip: IP });
    game.registry.streamOpened(1);
    game.registry.streamOpened(1);
    game.registry.streamClosed(1);
    expect(game.state.scoreboard.players[0]?.connected).toBe(true);
    game.registry.streamClosed(1);
    expect(game.state.scoreboard.players[0]?.connected).toBe(false);
  });

  it("renames a signed-in player unless another player holds the name", () => {
    const game = setup();
    game.host({ type: "score", op: "add", name: "Bea" });
    const joined = game.registry.join({ code: "ABCD", name: "Aki", ip: IP });
    if (!joined.ok) throw new Error("join failed");
    expect(game.registry.rename(joined.token, "bea")).toMatchObject({ ok: false, status: 409 });
    expect(game.registry.rename(joined.token, "Akira")).toEqual({ ok: true, name: "Akira" });
    expect(game.state.scoreboard.players[1]?.name).toBe("Akira");
    expect(game.registry.rename("nope", "X")).toMatchObject({ ok: false, status: 401 });
  });

  it("keeps sessions when the room code changes", () => {
    const game = setup([0, 1, 2, 3, 4, 5, 6, 7]);
    const joined = game.registry.join({ code: "ABCD", name: "Aki", ip: IP });
    if (!joined.ok) throw new Error("join failed");
    expect(game.registry.regenerateRoomCode()).toBe("EFGH");
    expect(game.registry.playerFor(joined.token)?.name).toBe("Aki");
    expect(game.registry.join({ code: "ABCD", name: "Bea", ip: "10.0.0.3" })).toMatchObject({ ok: false, status: 401 });
  });
});
