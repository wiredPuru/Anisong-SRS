import type { PartyPicture } from "~/composables/usePartyDisplay";

export const DEFAULT_HIDING_PICTURE: PartyPicture = "bubbles";

const HIDING_PICTURES: readonly PartyPicture[] = ["bubbles", "music"];

/**
 * What the V key does to the current song's picture: from Video it switches to
 * the hiding picture last used, from any hiding picture it goes back to Video.
 * `lastHiding` is returned updated, so a picture picked in the panel is
 * remembered the next time V is pressed over it.
 */
export function togglePicture(
  current: PartyPicture,
  lastHiding: PartyPicture,
): { picture: PartyPicture; lastHiding: PartyPicture } {
  if (current === "video") return { picture: lastHiding, lastHiding };
  return { picture: "video", lastHiding: HIDING_PICTURES.includes(current) ? current : lastHiding };
}
