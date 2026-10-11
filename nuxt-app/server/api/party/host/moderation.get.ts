import { partyPlayers } from "../../../utils/partyStore.ts";

// Addresses are for the host only: the player and display doors never see them.
export default defineEventHandler(() => ({
  bans: partyPlayers.bans(),
  addresses: partyPlayers.addresses(),
}));
