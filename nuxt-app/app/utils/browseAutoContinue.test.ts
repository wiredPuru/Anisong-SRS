import { describe, expect, it } from "vitest";
import { MAX_SCANNED_PAGES, MIN_UNOWNED_SHOWS, needsMorePages } from "./browseAutoContinue";

describe("needsMorePages", () => {
  it("keeps going while the list is short and AniList has more", () => {
    expect(needsMorePages(0, true, 1)).toBe(true);
    expect(needsMorePages(MIN_UNOWNED_SHOWS - 1, true, 3)).toBe(true);
  });

  it("stops once enough unowned shows are listed", () => {
    expect(needsMorePages(MIN_UNOWNED_SHOWS, true, 2)).toBe(false);
    expect(needsMorePages(MIN_UNOWNED_SHOWS + 30, true, 2)).toBe(false);
  });

  it("stops when AniList has no further page", () => {
    expect(needsMorePages(0, false, 1)).toBe(false);
  });

  it("stops once the page budget is spent, however short the list is", () => {
    expect(needsMorePages(0, true, MAX_SCANNED_PAGES - 1)).toBe(true);
    expect(needsMorePages(0, true, MAX_SCANNED_PAGES)).toBe(false);
    expect(needsMorePages(0, true, MAX_SCANNED_PAGES + 5)).toBe(false);
  });
});
