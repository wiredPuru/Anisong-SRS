import { toPlayerState } from "../../../utils/partyGame.ts";
import { getSessionPlayer } from "../../../utils/partySession.ts";
import { partyPlayers } from "../../../utils/partyStore.ts";
import { streamPartyView } from "../../../utils/partyStream.ts";

// Holding this stream open is what marks the player connected.
export default defineEventHandler((event) => {
  const playerId = getSessionPlayer(event)!.id;
  partyPlayers.streamOpened(playerId);
  return streamPartyView(event, (state) => toPlayerState(state, playerId), () => partyPlayers.streamClosed(playerId));
});
