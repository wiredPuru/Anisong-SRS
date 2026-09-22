import { parseDeckPatchBody } from "../utils/deckPatch.ts";
import { renameManualDeck, setManualDeckCriterion, type ManualDeckResult } from "../utils/decks.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseDeckPatchBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }

  // The criterion is already validated by the parser, so the only write that
  // can still be refused is the rename. Doing it first means a rejected name
  // leaves the criterion untouched too.
  let result: ManualDeckResult | undefined =
    parsed.name !== undefined ? renameManualDeck(parsed.id, parsed.name) : undefined;
  if (parsed.gradingCriterion !== undefined && (!result || "deck" in result)) {
    result = setManualDeckCriterion(parsed.id, parsed.gradingCriterion);
  }

  if (!result || "notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Deck not found" });
  }
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
