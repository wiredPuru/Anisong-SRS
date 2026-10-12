export const CARD_STATUSES = ["new", "learning", "known", "suspended"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  new: "New",
  learning: "Learning",
  known: "Known",
  suspended: "Suspended",
};

export function isCardStatus(value: unknown): value is CardStatus {
  return typeof value === "string" && (CARD_STATUSES as readonly string[]).includes(value);
}
