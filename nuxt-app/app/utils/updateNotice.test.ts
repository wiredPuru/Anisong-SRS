import { describe, expect, it } from "vitest";
import { downloadPlatformLabel, parseReleaseNotes } from "./updateNotice.ts";

describe("parseReleaseNotes", () => {
  it("parses the shape real release notes use", () => {
    const notes = [
      "A big release.",
      "",
      "**Study**",
      "- Filters by `year` and **season**",
      "- Auto Reveal",
      "",
      "**Fixes**",
      "- Tag breakdown",
    ].join("\n");

    expect(parseReleaseNotes(notes)).toEqual([
      { type: "paragraph", spans: [{ text: "A big release." }] },
      { type: "heading", text: "Study" },
      {
        type: "list",
        items: [
          [
            { text: "Filters by " },
            { text: "year", code: true },
            { text: " and " },
            { text: "season", bold: true },
          ],
          [{ text: "Auto Reveal" }],
        ],
      },
      { type: "heading", text: "Fixes" },
      { type: "list", items: [[{ text: "Tag breakdown" }]] },
    ]);
  });

  it("starts a list right after a heading with no blank line", () => {
    expect(parseReleaseNotes("## Library\n* One")).toEqual([
      { type: "heading", text: "Library" },
      { type: "list", items: [[{ text: "One" }]] },
    ]);
  });

  it("joins wrapped paragraph lines and handles CRLF", () => {
    expect(parseReleaseNotes("First line\r\nsecond line")).toEqual([
      { type: "paragraph", spans: [{ text: "First line second line" }] },
    ]);
  });

  it("keeps HTML as literal text rather than markup", () => {
    expect(parseReleaseNotes("<img src=x onerror=alert(1)>")).toEqual([
      { type: "paragraph", spans: [{ text: "<img src=x onerror=alert(1)>" }] },
    ]);
  });

  it("returns nothing for empty notes", () => {
    expect(parseReleaseNotes("")).toEqual([]);
    expect(parseReleaseNotes("\n\n  \n")).toEqual([]);
  });

  it("leaves unmatched markers as plain text", () => {
    expect(parseReleaseNotes("a ** b `c")).toEqual([
      { type: "paragraph", spans: [{ text: "a ** b `c" }] },
    ]);
  });
});

describe("downloadPlatformLabel", () => {
  it("names each packaged platform from its zip url", () => {
    expect(downloadPlatformLabel("https://x/v1.4.0/gaq-srs-macos-arm64.zip")).toBe(
      "macOS (Apple Silicon)",
    );
    expect(downloadPlatformLabel("https://x/v1.4.0/gaq-srs-windows-x64.zip")).toBe("Windows");
  });

  it("returns null for an unknown file", () => {
    expect(downloadPlatformLabel("https://x/other.zip")).toBeNull();
  });
});
