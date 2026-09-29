import { toDisplayState } from "../../../utils/partyGame.ts";
import { partyJoinInfo } from "../../../utils/partyStore.ts";
import { streamPartyView } from "../../../utils/partyStream.ts";

export default defineEventHandler((event) => streamPartyView(event, (state) => toDisplayState(state, partyJoinInfo())));
