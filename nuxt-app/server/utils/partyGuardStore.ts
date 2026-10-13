import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { partyGuard } from "../db/schema.ts";
import { DEFAULT_CREDITS_GUARD, DEFAULT_START_FLOOR, parseSavedGuard, type PartyCreditsGuard } from "./partyGuard.ts";

const ROW_ID = 1;

export function loadSavedGuard(): { startFloor: number; creditsGuard: PartyCreditsGuard } {
  try {
    const row = db.select({ settings: partyGuard.settings }).from(partyGuard).where(eq(partyGuard.id, ROW_ID)).get();
    return row ? parseSavedGuard(row.settings) : { startFloor: DEFAULT_START_FLOOR, creditsGuard: DEFAULT_CREDITS_GUARD };
  } catch {
    return { startFloor: DEFAULT_START_FLOOR, creditsGuard: DEFAULT_CREDITS_GUARD };
  }
}

export function storeSavedGuard(settings: { startFloor: number; creditsGuard: PartyCreditsGuard }): void {
  try {
    const value = JSON.stringify(settings);
    db.insert(partyGuard)
      .values({ id: ROW_ID, settings: value })
      .onConflictDoUpdate({ target: partyGuard.id, set: { settings: value } })
      .run();
  } catch {
    // A failed save only means the guard is not remembered next time.
  }
}
