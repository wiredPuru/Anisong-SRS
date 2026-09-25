import { AniListUserNotFoundError } from "../../lib/anilist.ts";
import { MalUserNotFoundError } from "../../lib/mal.ts";
import { LIST_SITES, type ListSite } from "../../utils/studyFilters.ts";
import { resolveListAnimeIds } from "../../utils/studyListFilter.ts";

export default defineEventHandler(async (event) => {
  const { site, username: rawUsername } = getQuery(event);
  const username = typeof rawUsername === "string" ? rawUsername.trim() : "";
  if (!LIST_SITES.includes(site as ListSite)) {
    throw createError({ statusCode: 400, statusMessage: "site must be 'anilist' or 'mal'" });
  }
  if (!username || username.length > 100) {
    throw createError({ statusCode: 400, statusMessage: "username is required" });
  }

  try {
    return await resolveListAnimeIds(site as ListSite, username);
  } catch (err) {
    if (err instanceof AniListUserNotFoundError || err instanceof MalUserNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: err.message });
    }
    throw err;
  }
});
