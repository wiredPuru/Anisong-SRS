import { ProviderRequestError } from "../../lib/graphql.ts";
import { refreshAnimeMetadata } from "../../utils/animeMetadataRefresh.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ animeId?: unknown } | null>(event);
  try {
    return await refreshAnimeMetadata(body?.animeId);
  } catch (error) {
    if (error instanceof ProviderRequestError) {
      throw createError({ statusCode: 502, statusMessage: "AniList could not process the metadata refresh. Please try again later." });
    }
    throw error;
  }
});
