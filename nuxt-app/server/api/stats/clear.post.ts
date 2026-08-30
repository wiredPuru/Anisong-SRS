import { clearReviewLog } from "../../utils/stats.ts";

export default defineEventHandler(() => {
  const deletedCount = clearReviewLog();
  return { success: true, deletedCount };
});
