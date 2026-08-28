import { getOverallStats, listAnimeStats, listArtistStats } from "../utils/stats.ts";

export default defineEventHandler((event) => {
  const { type } = getQuery(event);

  if (type === "overall") {
    return getOverallStats();
  }
  if (type === "artist") {
    return { stats: listArtistStats() };
  }
  if (type === "anime") {
    return { stats: listAnimeStats() };
  }

  throw createError({ statusCode: 400, statusMessage: "type must be 'overall', 'artist', or 'anime'" });
});
