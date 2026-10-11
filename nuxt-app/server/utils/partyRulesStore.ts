import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { partyRules } from "../db/schema.ts";

const ROW_ID = 1;

export function loadSavedRules(): string {
  try {
    return db.select({ text: partyRules.text }).from(partyRules).where(eq(partyRules.id, ROW_ID)).get()?.text ?? "";
  } catch {
    return "";
  }
}

export function storeSavedRules(text: string): void {
  try {
    db.insert(partyRules)
      .values({ id: ROW_ID, text })
      .onConflictDoUpdate({ target: partyRules.id, set: { text } })
      .run();
  } catch {
    // A failed save only means the rules are not remembered next time.
  }
}
