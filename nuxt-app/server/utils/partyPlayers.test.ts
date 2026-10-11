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

function joinFrom(game: ReturnType<typeof setup>, name: string, ip: string | null) {
  const result = game.registry.join({ name, ip });
  if (!result.ok) throw new Error(`join failed: ${result.message}`);
  return result;
}

describe("createPlayerRegistry addresses", () => {
  it("records where each player joined from, in normalised form", () => {
    const game = setup();
    const aki = joinFrom(game, "Aki", "::ffff:192.168.1.20");
    expect(game.registry.ipOf(aki.player.id)).toBe("192.168.1.20");
  });

  it("forgets the address when a later join has none", () => {
    const game = setup();
    const aki = joinFrom(game, "Aki", "10.0.0.2");
    game.registry.join({ name: "Aki", token: aki.token, ip: null });
    expect(game.registry.ipOf(aki.player.id)).toBeNull();
  });

  it("moves a claimed player's address to the new phone", () => {
    const game = setup();
    joinFrom(game, "Aki", "10.0.0.2");
    joinFrom(game, "AKI", "10.0.0.9");
    expect(game.registry.ipOf(1)).toBe("10.0.0.9");
  });

  it("counts the other players sharing an address", () => {
    const game = setup();
    joinFrom(game, "Aki", "10.0.0.2");
    joinFrom(game, "Bea", "10.0.0.2");
    joinFrom(game, "Cy", "10.0.0.3");
    joinFrom(game, "Dee", null);
    expect(game.registry.addresses()).toEqual([
      { id: 1, ip: "10.0.0.2", sharedWith: 1 },
      { id: 2, ip: "10.0.0.2", sharedWith: 1 },
      { id: 3, ip: "10.0.0.3", sharedWith: 0 },
      { id: 4, ip: null, sharedWith: 0 },
    ]);
  });
});

describe("createPlayerRegistry ban", () => {
  it("bans the address, signs the phone out and removes the player", () => {
    const game = setup();
    const aki = joinFrom(game, "Aki", "10.0.0.2");
    expect(game.registry.ban(aki.player.id)).toEqual({ ok: true, ip: "10.0.0.2", removed: 1 });
    expect(game.registry.playerFor(aki.token)).toBeNull();
    expect(game.state.scoreboard.players).toHaveLength(0);
    expect(game.registry.wasKicked(aki.player.id)).toBe(true);
    expect(game.registry.isBanned("10.0.0.2")).toBe(true);
    expect(game.registry.bans()).toEqual([{ ip: "10.0.0.2", name: "Aki", bannedAt: expect.any(Number) }]);
  });

  it("removes every player recorded from that address and no one else", () => {
    const game = setup();
    const aki = joinFrom(game, "Aki", "10.0.0.2");
    const bea = joinFrom(game, "Bea", "10.0.0.2");
    const cy = joinFrom(game, "Cy", "10.0.0.3");
    expect(game.registry.ban(aki.player.id)).toMatchObject({ ok: true, removed: 2 });
    expect(game.registry.playerFor(bea.token)).toBeNull();
    expect(game.registry.playerFor(cy.token)?.name).toBe("Cy");
    expect(game.state.scoreboard.players.map((p) => p.name)).toEqual(["Cy"]);
  });

  it("refuses a join from a banned address, however it is written", () => {
    const game = setup();
    const aki = joinFrom(game, "Aki", "10.0.0.2");
    game.registry.ban(aki.player.id);
    expect(game.registry.join({ name: "Aki", ip: "10.0.0.2" })).toEqual({
      ok: false,
      status: 403,
      message: "You can't join this game.",
    });
    expect(game.registry.join({ name: "Other", ip: "::ffff:10.0.0.2" })).toMatchObject({ ok: false, status: 403 });
    expect(game.state.scoreboard.players).toHaveLength(0);
  });

  it("still lets other addresses and addressless joins in", () => {
    const game = setup();
    const aki = joinFrom(game, "Aki", "10.0.0.2");
    game.registry.ban(aki.player.id);
    expect(game.registry.join({ name: "Bea", ip: "10.0.0.3" })).toMatchObject({ ok: true });
    expect(game.registry.join({ name: "Cy", ip: null })).toMatchObject({ ok: true });
  });

  it("answers unknown for a missing player and noAddress for one without an address", () => {
    const game = setup();
    expect(game.registry.ban(99)).toEqual({ ok: false, reason: "unknown" });
    const aki = joinFrom(game, "Aki", null);
    expect(game.registry.ban(aki.player.id)).toEqual({ ok: false, reason: "noAddress" });
    expect(game.registry.bans()).toEqual([]);
    expect(game.state.scoreboard.players).toHaveLength(1);
  });

  it("unbans an address, once, and then it can join again", () => {
    const game = setup();
    const aki = joinFrom(game, "Aki", "10.0.0.2");
    game.registry.ban(aki.player.id);
    expect(game.registry.unban("::ffff:10.0.0.2")).toBe(true);
    expect(game.registry.unban("10.0.0.2")).toBe(false);
    expect(game.registry.isBanned("10.0.0.2")).toBe(false);
    expect(game.registry.join({ name: "Aki", ip: "10.0.0.2" })).toMatchObject({ ok: true });
  });

  it("a second ban of an address from a later player keeps one entry", () => {
    const game = setup();
    const aki = joinFrom(game, "Aki", "10.0.0.2");
    game.registry.ban(aki.player.id);
    game.registry.unban("10.0.0.2");
    const bea = joinFrom(game, "Bea", "10.0.0.2");
    game.registry.ban(bea.player.id);
    expect(game.registry.bans().map((b) => b.name)).toEqual(["Bea"]);
  });

  it("treats a missing address as not banned", () => {
    const game = setup();
    expect(game.registry.isBanned(null)).toBe(false);
    expect(game.registry.isBanned(undefined)).toBe(false);
    expect(game.registry.unban("")).toBe(false);
  });

  it("lists bans oldest first", () => {
    const game = setup();
    const aki = joinFrom(game, "Aki", "10.0.0.2");
    const bea = joinFrom(game, "Bea", "10.0.0.3");
    game.registry.ban(aki.player.id);
    game.registry.ban(bea.player.id);
    expect(game.registry.bans().map((b) => b.ip)).toEqual(["10.0.0.2", "10.0.0.3"]);
  });
});
