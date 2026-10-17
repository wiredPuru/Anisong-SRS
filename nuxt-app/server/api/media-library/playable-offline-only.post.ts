import { setPlayableOfflineOnly } from "../../utils/mediaLibrary.ts";

export default defineEventHandler(async (event) => {
  const body: unknown = await readBody(event);
  const enabled = typeof body === "object" && body !== null && "enabled" in body ? body.enabled : undefined;
  const result = setPlayableOfflineOnly(enabled);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }
  setHeader(event, "cache-control", "no-store");
  return result;
});
