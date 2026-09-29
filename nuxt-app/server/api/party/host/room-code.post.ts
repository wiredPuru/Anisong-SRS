import { partyJoinInfo, regeneratePartyRoomCode } from "../../../utils/partyStore.ts";

export default defineEventHandler(() => {
  regeneratePartyRoomCode();
  return partyJoinInfo();
});
