import { describe, expect, it } from "vitest";
import { artistCatalogQuery } from "./artistCatalog";

describe("artistCatalogQuery", () => {
  it("returns a normal name as is", () => {
    expect(artistCatalogQuery("Yui Horie")).toBe("Yui Horie");
  });

  it("trims surrounding whitespace", () => {
    expect(artistCatalogQuery("  milet \n")).toBe("milet");
  });

  it("returns null for a blank name", () => {
    expect(artistCatalogQuery("")).toBeNull();
    expect(artistCatalogQuery("   ")).toBeNull();
  });

  it("returns null under the 2 character minimum and accepts exactly 2", () => {
    expect(artistCatalogQuery("Y")).toBeNull();
    expect(artistCatalogQuery("ai")).toBe("ai");
  });

  it("returns null for the Unknown Artist placeholder in any casing", () => {
    expect(artistCatalogQuery("Unknown Artist")).toBeNull();
    expect(artistCatalogQuery("  UNKNOWN ARTIST ")).toBeNull();
  });

  it("keeps a Japanese name", () => {
    expect(artistCatalogQuery("堀江由衣")).toBe("堀江由衣");
  });
});
