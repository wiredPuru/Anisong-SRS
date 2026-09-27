import { parsePartyCommand, toHostState } from "../../../utils/partyGame.ts";
import { getPartyState, runPartyCommand } from "../../../utils/partyStore.ts";

export default defineEventHandler(async (event) => {
  const command = parsePartyCommand(await readBody(event).catch(() => null));
  if ("error" in command) {
    throw createError({ statusCode: 400, statusMessage: command.error });
  }
  const result = runPartyCommand(command);
  return { ...result, state: toHostState(getPartyState()) };
});
