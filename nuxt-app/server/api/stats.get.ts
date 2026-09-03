import { getOverallStats, getReviewTimeline, listAnimeStats, listArtistStats } from "../utils/stats.ts";
import type { ReviewTimelineRange } from "../utils/stats.ts";

const TIMELINE_RANGES: ReviewTimelineRange[] = ["30", "90", "all"];

export default defineEventHandler((event) => {
  const { type, range } = getQuery(event);

  if (type === "overall") {
    return getOverallStats();
  }
  if (type === "artist") {
    return { stats: listArtistStats() };
  }
  if (type === "anime") {
    return { stats: listAnimeStats() };
  }
  if (type === "timeline") {
    if (typeof range !== "string" || !TIMELINE_RANGES.includes(range as ReviewTimelineRange)) {
      throw createError({ statusCode: 400, statusMessage: "range must be '30', '90', or 'all'" });
    }
    return { entries: getReviewTimeline(range as ReviewTimelineRange) };
  }

  throw createError({ statusCode: 400, statusMessage: "type must be 'overall', 'artist', 'anime', or 'timeline'" });
});
