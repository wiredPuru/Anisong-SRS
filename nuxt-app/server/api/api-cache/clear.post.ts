import { clearApiCache } from "../../utils/apiCache.ts";

export default defineEventHandler(() => ({ cleared: clearApiCache() }));
