import { browseAniList } from "../../lib/anilistBrowse.ts";
import { parseBrowseBody } from "../../utils/anilistBrowseBody.ts";
import { withLibraryFlags } from "../../utils/anilistBrowseLibrary.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseBrowseBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  const { items, hasNextPage } = await browseAniList(parsed.filters, parsed.page);
  return { results: withLibraryFlags(items), hasNextPage };
});
