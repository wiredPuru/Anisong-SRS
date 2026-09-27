import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { partyHost } from "../db/schema.ts";

const HOST_ID = 1;

export function getPartyPasswordHash(): string | null {
  return db.select().from(partyHost).where(eq(partyHost.id, HOST_ID)).get()?.passwordHash ?? null;
}

export function setPartyPasswordHash(passwordHash: string): void {
  db.insert(partyHost)
    .values({ id: HOST_ID, passwordHash, updatedAt: new Date() })
    .onConflictDoUpdate({ target: partyHost.id, set: { passwordHash, updatedAt: new Date() } })
    .run();
}
