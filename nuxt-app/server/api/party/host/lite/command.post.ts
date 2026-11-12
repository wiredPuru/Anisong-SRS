import { parseLiteCommand } from "../../../../utils/partyLiteGame.ts";
import { runLiteCommand } from "../../../../utils/partyLiteStore.ts";

export default defineEventHandler(async (event) => {
  const command = parseLiteCommand(await readBody(event).catch(() => null));
  if ("error" in command) {
    throw createError({ statusCode: 400, statusMessage: command.error });
  }
  const result = runLiteCommand(command);
  if (result.error) {
    throw createError({ statusCode: 409, statusMessage: result.error });
  }
  return { ok: true };
});
