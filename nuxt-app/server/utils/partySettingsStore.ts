import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { partySettings } from "../db/schema.ts";
import { isDisplayTheme, type PartyDisplayTheme } from "./partyGame.ts";

const ROW_ID = 1;

/** The saved display theme, or null when none is saved or it is no longer a known theme. */
export function loadSavedDisplayTheme(): PartyDisplayTheme | null {
  try {
    const saved = db.select({ theme: partySettings.displayTheme }).from(partySettings).where(eq(partySettings.id, ROW_ID)).get()?.theme;
    return isDisplayTheme(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function storeSavedDisplayTheme(theme: PartyDisplayTheme): void {
  try {
    db.insert(partySettings)
      .values({ id: ROW_ID, displayTheme: theme })
      .onConflictDoUpdate({ target: partySettings.id, set: { displayTheme: theme } })
      .run();
  } catch {
    // A failed save only means the theme is not remembered next time.
  }
}
