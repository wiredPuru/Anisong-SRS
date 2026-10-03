import { describe, expect, it } from "vitest";
import { MAX_DECK_PICTURE_BYTES, validateDeckPicture } from "./deckPicture";

describe("validateDeckPicture", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])("accepts a small %s", (type) => {
    expect(validateDeckPicture({ type, size: 1024 })).toBeNull();
  });

  it.each(["image/gif", "image/svg+xml", "text/plain", "application/pdf", ""])("rejects type %j", (type) => {
    expect(validateDeckPicture({ type, size: 1024 })).toMatch(/PNG, JPEG or WebP/);
  });

  it("accepts a file exactly at the cap and rejects one byte over", () => {
    expect(validateDeckPicture({ type: "image/png", size: MAX_DECK_PICTURE_BYTES })).toBeNull();
    expect(validateDeckPicture({ type: "image/png", size: MAX_DECK_PICTURE_BYTES + 1 })).toMatch(/5 MB/);
  });

  it("rejects an empty file", () => {
    expect(validateDeckPicture({ type: "image/png", size: 0 })).toMatch(/empty/);
  });

  it("checks the type before the size", () => {
    expect(validateDeckPicture({ type: "text/plain", size: MAX_DECK_PICTURE_BYTES + 1 })).toMatch(/PNG, JPEG or WebP/);
  });
});
