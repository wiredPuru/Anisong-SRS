import { fetchBrowseOptions } from "../../lib/anilistBrowse.ts";
import { createTimedCache } from "../../utils/timedCache.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const loadOptions = createTimedCache(fetchBrowseOptions, DAY_MS);

export default defineEventHandler(() => loadOptions());
