import { randomBytes } from "node:crypto";
import { planJoin, planRename, type PartyInternalCommand, type PartyPlayer } from "./partyGame.ts";

export type PlayerJoinResult =
  | { ok: true; token: string; player: PartyPlayer }
  | { ok: false; status: 400 | 409; message: string };

type RenameCommand = { type: "score"; op: "rename"; id: number; name: string };

interface RegistryDeps {
  getPlayers: () => readonly PartyPlayer[];
  apply: (command: PartyInternalCommand | RenameCommand) => void;
}

const JOIN_ERRORS = {
  invalid: { status: 400, message: "Names are 1-24 characters." },
  taken: { status: 409, message: "Someone is already using that name." },
  full: { status: 409, message: "The game is full." },
} as const;

/**
 * Who is signed in from which phone. Sessions live in memory, like the host's:
 * a token is only good while its player is still on the scoreboard, so a
 * removal or a party restart signs that phone out.
 */
export function createPlayerRegistry({ getPlayers, apply }: RegistryDeps) {
  const sessions = new Map<string, number>();
  const openStreams = new Map<number, number>();

  const find = (id: number) => getPlayers().find((p) => p.id === id) ?? null;
  const playerFor = (token: string | undefined | null): PartyPlayer | null => {
    const id = token ? sessions.get(token) : undefined;
    return id === undefined ? null : find(id);
  };
  const startSession = (playerId: number) => {
    const token = randomBytes(24).toString("hex");
    sessions.set(token, playerId);
    return token;
  };
  // A claimed player moves to the new phone; the old phone must not share it.
  const revokeFor = (playerId: number) => {
    for (const [token, id] of sessions) if (id === playerId) sessions.delete(token);
  };

  return {
    playerFor,

    join({ name, token }: { name: unknown; token?: string | null }): PlayerJoinResult {
      const existing = playerFor(token);
      if (existing && token) return { ok: true, token, player: existing };

      const plan = planJoin(getPlayers(), name);
      if ("error" in plan) return { ok: false, ...JOIN_ERRORS[plan.error] };
      const trimmed = (name as string).trim();
      if ("claimId" in plan) revokeFor(plan.claimId);
      apply({ type: "playerJoin", name: trimmed, claimId: "claimId" in plan ? plan.claimId : null });

      const joined = "claimId" in plan
        ? find(plan.claimId)
        : getPlayers().find((p) => p.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase()) ?? null;
      if (!joined) return { ok: false, ...JOIN_ERRORS.full };
      return { ok: true, token: startSession(joined.id), player: joined };
    },

    rename(token: string | undefined | null, name: unknown): { ok: true; name: string } | { ok: false; status: 400 | 401 | 409; message: string } {
      const me = playerFor(token);
      if (!me) return { ok: false, status: 401, message: "Join the game first" };
      const plan = planRename(getPlayers(), me.id, name);
      if ("error" in plan) return { ok: false, ...JOIN_ERRORS[plan.error] };
      apply({ type: "score", op: "rename", id: me.id, name: plan.name });
      return { ok: true, name: plan.name };
    },

    // Counted, so a second tab closing does not mark a still-open phone offline.
    streamOpened(playerId: number): void {
      const count = (openStreams.get(playerId) ?? 0) + 1;
      openStreams.set(playerId, count);
      if (count === 1) apply({ type: "playerConnection", id: playerId, connected: true });
    },
    streamClosed(playerId: number): void {
      const count = (openStreams.get(playerId) ?? 1) - 1;
      if (count > 0) {
        openStreams.set(playerId, count);
        return;
      }
      openStreams.delete(playerId);
      apply({ type: "playerConnection", id: playerId, connected: false });
    },
  };
}

export type PlayerRegistry = ReturnType<typeof createPlayerRegistry>;
