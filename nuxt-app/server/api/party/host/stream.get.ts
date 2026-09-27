import { toHostState } from "../../../utils/partyGame.ts";
import { streamPartyView } from "../../../utils/partyStream.ts";

export default defineEventHandler((event) => streamPartyView(event, toHostState));
