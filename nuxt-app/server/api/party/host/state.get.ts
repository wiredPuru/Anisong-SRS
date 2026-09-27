import { toHostState } from "../../../utils/partyGame.ts";
import { getPartyState } from "../../../utils/partyStore.ts";

export default defineEventHandler(() => toHostState(getPartyState()));
