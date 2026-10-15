import { describe, expect, it } from "vitest";
import { parseBulkDownloadKinds, selectedDownloadKinds } from "./bulkDownloadKinds";

describe("selectedDownloadKinds", () => {
  it("lists video before audio", () => {
    expect(selectedDownloadKinds({ video: true, audio: true })).toEqual(["video", "audio"]);
  });

  it("keeps only the ticked kinds", () => {
    expect(selectedDownloadKinds({ video: false, audio: true })).toEqual(["audio"]);
    expect(selectedDownloadKinds({ video: true, audio: false })).toEqual(["video"]);
    expect(selectedDownloadKinds({ video: false, audio: false })).toEqual([]);
  });
});

describe("parseBulkDownloadKinds", () => {
  it("reads a stored choice", () => {
    expect(parseBulkDownloadKinds('{"video":false,"audio":true}')).toEqual({ video: false, audio: true });
  });

  it("defaults to both when nothing usable is stored", () => {
    for (const raw of [null, "", "not json", "[]", '{"video":"yes","audio":true}', '{"video":true}']) {
      expect(parseBulkDownloadKinds(raw)).toEqual({ video: true, audio: true });
    }
  });
});
