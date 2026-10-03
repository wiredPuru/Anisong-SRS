import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { deck } from "../db/schema.ts";
import { MAX_DECK_IMAGE_BYTES } from "./deckImage.ts";
import { deckImageFolder, getDeckImageFile, removeDeckImage, saveDeckImage } from "./deckImageStore.ts";
import { createManualDeck, deleteManualDeck, listManualDecks } from "./decks.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);

let dataDir: string;
let deckId: number;

function files(): string[] {
  return existsSync(deckImageFolder()) ? readdirSync(deckImageFolder()) : [];
}

function storedName(): string | null {
  return db.select({ imagePath: deck.imagePath }).from(deck).where(eq(deck.id, deckId)).get()!.imagePath;
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "gaq-deck-images-"));
  vi.stubEnv("GAQ_SRS_DATA_DIR", dataDir);
  const created = createManualDeck("Bangers");
  deckId = "deck" in created ? created.deck.id : -1;
});

afterEach(() => {
  db.delete(deck).run();
  vi.unstubAllEnvs();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("saveDeckImage", () => {
  it("writes the file under deck-images beside the database and records its name", () => {
    const result = saveDeckImage(deckId, png);
    const name = storedName()!;

    expect(name).toMatch(new RegExp(`^${deckId}-[0-9a-f]{8}\\.png$`));
    expect(result).toEqual({ imageUrl: `/api/decks/image?id=${deckId}&v=${name}` });
    expect(deckImageFolder()).toBe(join(dataDir, "deck-images"));
    expect(files()).toEqual([name]);
    expect(Array.from(readFileSync(join(deckImageFolder(), name)))).toEqual(Array.from(png));
  });

  it("replaces a previous picture and deletes its file", () => {
    saveDeckImage(deckId, png);
    const first = storedName()!;
    saveDeckImage(deckId, jpeg);
    const second = storedName()!;

    expect(second).not.toBe(first);
    expect(second.endsWith(".jpg")).toBe(true);
    expect(files()).toEqual([second]);
  });

  it("returns not-found for an unknown deck without writing a file", () => {
    expect(saveDeckImage(deckId + 999, png)).toEqual({ notFound: true });
    expect(files()).toEqual([]);
  });

  it("refuses a file over the cap and one that is not a PNG, JPEG or WebP, writing nothing", () => {
    const big = new Uint8Array(MAX_DECK_IMAGE_BYTES + 1);
    big.set(png);
    expect(saveDeckImage(deckId, big)).toEqual({ error: "too-large" });
    expect(saveDeckImage(deckId, new TextEncoder().encode("<svg/>"))).toEqual({ error: "unsupported" });
    expect(files()).toEqual([]);
    expect(storedName()).toBeNull();
  });

  it("keeps the old picture when a replacement is refused", () => {
    saveDeckImage(deckId, png);
    const first = storedName();
    saveDeckImage(deckId, new TextEncoder().encode("nope"));

    expect(storedName()).toBe(first);
    expect(files()).toEqual([first]);
  });
});

describe("removeDeckImage", () => {
  it("clears the column and the file", () => {
    saveDeckImage(deckId, png);
    expect(removeDeckImage(deckId)).toEqual({ success: true });
    expect(storedName()).toBeNull();
    expect(files()).toEqual([]);
  });

  it("is idempotent for a deck with no picture and not-found for an unknown deck", () => {
    expect(removeDeckImage(deckId)).toEqual({ success: true });
    expect(removeDeckImage(deckId + 999)).toEqual({ notFound: true });
  });
});

describe("getDeckImageFile", () => {
  it("returns the deck's file and MIME type, or null when there is none", () => {
    expect(getDeckImageFile(deckId)).toBeNull();
    saveDeckImage(deckId, jpeg);
    const found = getDeckImageFile(deckId)!;
    expect(found.mime).toBe("image/jpeg");
    expect(found.path).toBe(join(deckImageFolder(), storedName()!));
  });

  it("returns null when the file has gone missing from disk", () => {
    saveDeckImage(deckId, png);
    rmSync(join(deckImageFolder(), storedName()!));
    expect(getDeckImageFile(deckId)).toBeNull();
  });
});

describe("deck lifecycle", () => {
  it("deleting the deck removes its picture file", () => {
    saveDeckImage(deckId, png);
    expect(deleteManualDeck(deckId)).toBe(true);
    expect(files()).toEqual([]);
  });

  it("listManualDecks carries imageUrl, null until a picture is set and again once removed", () => {
    expect(listManualDecks(1).items[0]!.imageUrl).toBeNull();
    saveDeckImage(deckId, png);
    expect(listManualDecks(1).items[0]!.imageUrl).toBe(`/api/decks/image?id=${deckId}&v=${storedName()}`);
    removeDeckImage(deckId);
    expect(listManualDecks(1).items[0]!.imageUrl).toBeNull();
  });

  it("never exposes the raw imagePath on a listed deck", () => {
    saveDeckImage(deckId, png);
    expect(listManualDecks(1).items[0]).not.toHaveProperty("imagePath");
  });
});
