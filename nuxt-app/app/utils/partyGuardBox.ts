import type { PartyCensorBox } from "~/composables/usePartyDisplay";
import { moveBox, resizeBox } from "./partyCensorBoxes";

export type GuardDrag = { mode: "move" | "resize"; startX: number; startY: number; original: PartyCensorBox };

/** The box after the pointer has moved from where a drag began, as fractions of the picture. */
export function dragGuardBox(drag: GuardDrag, x: number, y: number): PartyCensorBox {
  const dx = x - drag.startX;
  const dy = y - drag.startY;
  return drag.mode === "move" ? moveBox(drag.original, dx, dy) : resizeBox(drag.original, dx, dy);
}
