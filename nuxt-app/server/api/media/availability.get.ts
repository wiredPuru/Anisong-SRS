import { localMediaAvailable } from "../../utils/localMedia.ts";

export default defineEventHandler((event) => {
  setHeader(event, "cache-control", "no-store");
  return { available: localMediaAvailable(getQuery(event).path) };
});
