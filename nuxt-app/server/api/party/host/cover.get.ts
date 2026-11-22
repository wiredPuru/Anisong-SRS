import { servePartyCover } from "../../../utils/partyCover.ts";

export default defineEventHandler((event) => servePartyCover(event));
