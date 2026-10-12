import { describe, expect, it } from "vitest";
import { CARD_STATUSES, CARD_STATUS_LABELS, isCardStatus } from "./cardStatus";

describe("card status", () => {
  it("labels every status", () => {
    expect(CARD_STATUSES.map((status) => CARD_STATUS_LABELS[status])).toEqual(["New", "Learning", "Known", "Suspended"]);
  });

  it("accepts only the four statuses", () => {
    expect(CARD_STATUSES.every(isCardStatus)).toBe(true);
    expect(isCardStatus("buried")).toBe(false);
    expect(isCardStatus("")).toBe(false);
    expect(isCardStatus(null)).toBe(false);
  });
});
