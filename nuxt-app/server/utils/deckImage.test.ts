import { describe, expect, it } from "vitest";
import {
  deckImageFileName,
  isSafeDeckImageName,
  MAX_DECK_IMAGE_BYTES,
  mimeForDeckImageName,
  sniffImageType,
} from "./deckImage.ts";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56]);
const encode = (text: string) => new TextEncoder().encode(text);

describe("sniffImageType", () => {
  it("recognises PNG, JPEG and WebP by their leading bytes", () => {
    expect(sniffImageType(png)).toBe("png");
    expect(sniffImageType(jpeg)).toBe("jpeg");
    expect(sniffImageType(webp)).toBe("webp");
  });

  it("rejects an empty buffer and truncated headers", () => {
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(png.slice(0, 4))).toBeNull();
    expect(sniffImageType(webp.slice(0, 10))).toBeNull();
  });

  it("rejects text, SVG and other RIFF files whatever they are named", () => {
    expect(sniffImageType(encode("hello, not an image"))).toBeNull();
    expect(sniffImageType(encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    const wave = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]);
    expect(sniffImageType(wave)).toBeNull();
  });
});

describe("deck image file names", () => {
  it("builds a name from the deck id, token and sniffed type", () => {
    expect(deckImageFileName(12, "jpeg", "a3f9c01b")).toBe("12-a3f9c01b.jpg");
    expect(deckImageFileName(3, "png", "00112233")).toBe("3-00112233.png");
    expect(deckImageFileName(3, "webp", "00112233")).toBe("3-00112233.webp");
  });

  it("accepts only names it built itself", () => {
    expect(isSafeDeckImageName("12-a3f9c01b.jpg")).toBe(true);
    expect(isSafeDeckImageName("12-a3f9c01b.webp")).toBe(true);
  });

  it.each([
    "../secret.png",
    "..\\secret.png",
    "a/b.png",
    "12-a3f9c01b.png.exe",
    "12-A3F9C01B.png",
    "12-a3f9c01.png",
    "12-a3f9c01b.svg",
    "12-a3f9c01b.gif",
    "",
    ".png",
  ])("refuses %j", (name) => {
    expect(isSafeDeckImageName(name)).toBe(false);
  });

  it("maps a safe name to its MIME type and a bad one to null", () => {
    expect(mimeForDeckImageName("1-00112233.png")).toBe("image/png");
    expect(mimeForDeckImageName("1-00112233.jpg")).toBe("image/jpeg");
    expect(mimeForDeckImageName("1-00112233.webp")).toBe("image/webp");
    expect(mimeForDeckImageName("../x.png")).toBeNull();
  });
});

describe("MAX_DECK_IMAGE_BYTES", () => {
  it("is 5 MB", () => {
    expect(MAX_DECK_IMAGE_BYTES).toBe(5 * 1024 * 1024);
  });
});
