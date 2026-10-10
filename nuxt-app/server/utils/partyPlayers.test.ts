import { describe, expect, it } from "vitest";
import { applyPartyCommand, initialPartyState, type PartyGameState } from "./partyGame.ts";
import { createPlayerRegistry } from "./partyPlayers.ts";

function setup() {
  let state: PartyGameState = initialPartyState();
  const registry = createPlayerRegistry({
    getPlayers: () => state.scoreboard.players,
    apply: (command) => {
      state = applyPartyCommand(state, command);
    },
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

describe("createPlayerRegistry kick", () => {
  it("revokes the session, drops the player and remembers why", () => {
    const game = setup();
    const joined = game.registry.join({ name: "Aki" });
    if (!joined.ok) throw new Error("join failed");
    expect(game.registry.kick(joined.player.id)).toBe(true);
    expect(game.registry.playerFor(joined.token)).toBeNull();
    expect(game.state.scoreboard.players).toHaveLength(0);
    expect(game.registry.wasKicked(joined.player.id)).toBe(true);
  });

  it("is a no-op for an unknown or already kicked player", () => {
    const game = setup();
    const joined = game.registry.join({ name: "Aki" });
    if (!joined.ok) throw new Error("join failed");
    expect(game.registry.kick(99)).toBe(false);
    expect(game.registry.kick(joined.player.id)).toBe(true);
    expect(game.registry.kick(joined.player.id)).toBe(false);
  });

  it("does not mark a plain removal as a kick", () => {
    const game = setup();
    const joined = game.registry.join({ name: "Aki" });
    if (!joined.ok) throw new Error("join failed");
    game.host({ type: "score", op: "remove", id: joined.player.id });
    expect(game.registry.wasKicked(joined.player.id)).toBe(false);
  });
});

describe("createPlayerRegistry", () => {
  it("joins with a name and signs the phone in", () => {
    const game = setup();
    const result = game.registry.join({ name: "  Aki " });
    expect(result).toMatchObject({ ok: true, player: { id: 1, name: "Aki", phone: true } });
    if (!result.ok) return;
    expect(game.registry.playerFor(result.token)?.id).toBe(1);
  });

  it("gives a phone with a live session its own player back instead of a second one", () => {
    const game = setup();
    const first = game.registry.join({ name: "Aki" });
    if (!first.ok) throw new Error("join failed");
    const again = game.registry.join({ name: "Other", token: first.token });
    expect(again).toMatchObject({ ok: true, token: first.token, player: { id: 1, name: "Aki" } });
    expect(game.state.scoreboard.players).toHaveLength(1);
  });

  it("claims a host-added player and keeps its score", () => {
    const game = setup();
    game.host({ type: "score", op: "add", name: "Bea" });
    game.host({ type: "score", op: "adjust", id: 1, delta: 4 });
    expect(game.registry.join({ name: "bea" })).toMatchObject({ ok: true, player: { id: 1, score: 4, phone: true } });
  });

  it("refuses a name a connected phone holds, and moves a disconnected one to the new phone", () => {
    const game = setup();
    const first = game.registry.join({ name: "Aki" });
    if (!first.ok) throw new Error("join failed");
    game.registry.streamOpened(1);
    expect(game.registry.join({ name: "AKI" })).toMatchObject({ ok: false, status: 409 });

    game.registry.streamClosed(1);
    const second = game.registry.join({ name: "AKI" });
    expect(second).toMatchObject({ ok: true, player: { id: 1 } });
    expect(game.registry.playerFor(first.token)).toBeNull();
  });

  it("refuses a full game and an invalid name", () => {
    const game = setup();
    for (let i = 1; i <= 20; i++) game.host({ type: "score", op: "add", name: `P${i}` });
    expect(game.registry.join({ name: "New" })).toMatchObject({ ok: false, status: 409, message: "The game is full." });
    expect(game.registry.join({ name: "" })).toMatchObject({ ok: false, status: 400 });
  });

  it("signs a phone out once the host removes its player", () => {
    const game = setup();
    const joined = game.registry.join({ name: "Aki" });
    if (!joined.ok) throw new Error("join failed");
    game.host({ type: "score", op: "remove", id: 1 });
    expect(game.registry.playerFor(joined.token)).toBeNull();
  });

  it("keeps a player connected until the last of its streams closes", () => {
    const game = setup();
    game.registry.join({ name: "Aki" });
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
    const joined = game.registry.join({ name: "Aki" });
    if (!joined.ok) throw new Error("join failed");
    expect(game.registry.rename(joined.token, "bea")).toMatchObject({ ok: false, status: 409 });
    expect(game.registry.rename(joined.token, "Akira")).toEqual({ ok: true, name: "Akira" });
    expect(game.state.scoreboard.players[1]?.name).toBe("Akira");
    expect(game.registry.rename("nope", "X")).toMatchObject({ ok: false, status: 401 });
  });
});
