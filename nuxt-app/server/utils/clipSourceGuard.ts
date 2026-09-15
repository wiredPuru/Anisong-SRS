import { createError } from "h3";
import { isClipUrlAllowed } from "./clipSource.ts";
import { getClipSource } from "./mediaLibrary.ts";

// Checked before any cache lookup, so a clip already cached from a host the
// setting now excludes is refused too: what plays must not depend on what
// happened to be cached earlier.
export function assertClipUrlAllowed(url: string): void {
  if (isClipUrlAllowed(url, getClipSource())) return;
  // A card's stored URL reaches here unparsed from the download route, and a
  // malformed one must still come back as this 403 rather than a TypeError 500.
  const host = URL.canParse(url) ? new URL(url).hostname : "this URL";
  throw createError({
    statusCode: 403,
    statusMessage: `Clip source setting does not allow ${host}`,
  });
}
