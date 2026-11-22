import { servePartyCover } from "../../../utils/partyCover.ts";

// Cover mode and the reveal card show the answer's artwork by token, so the
// display never receives an AniList URL.
export default defineEventHandler((event) => servePartyCover(event));
