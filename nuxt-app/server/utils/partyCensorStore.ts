import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { partyCensor } from "../db/schema.ts";
import { parseCensorTrack, type PartyCensorKey } from "./partyCensor.ts";

export function loadSavedCensor(cardId: number): PartyCensorKey[] {
  try {
    const row = db.select({ track: partyCensor.track }).from(partyCensor).where(eq(partyCensor.cardId, cardId)).get();
    return row ? parseCensorTrack(JSON.parse(row.track)) : [];
  } catch {
    return [];
  }
}

/** Saves a song's track, or forgets it when the host unticked Remember or left no changes. */
export function storeSavedCensor(cardId: number, remember: boolean, track: readonly PartyCensorKey[]): void {
  try {
    if (!remember || !track.length) {
      db.delete(partyCensor).where(eq(partyCensor.cardId, cardId)).run();
      return;
    }
    const value = JSON.stringify(track);
    db.insert(partyCensor)
      .values({ cardId, track: value })
      .onConflictDoUpdate({ target: partyCensor.cardId, set: { track: value, updatedAt: new Date() } })
      .run();
  } catch {
    // A failed save loses only the remembered censor, never the game.
  }
}
