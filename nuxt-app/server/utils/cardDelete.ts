export const BULK_DELETE_MAX = 500;

export type DeleteCardsBody = { kind: "single"; id: number } | { kind: "bulk"; ids: number[] };

function isCardId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Validates a DELETE /api/cards body, returning an error message when it is unusable. */
export function parseDeleteBody(body: unknown): DeleteCardsBody | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "id or ids is required" };
  }
  const { id, ids } = body as { id?: unknown; ids?: unknown };

  if (ids !== undefined) {
    if (!Array.isArray(ids) || ids.length === 0) return { error: "ids must be a non-empty array" };
    if (ids.length > BULK_DELETE_MAX) return { error: `ids may hold at most ${BULK_DELETE_MAX} entries` };
    if (!ids.every(isCardId)) return { error: "ids must all be positive integers" };
    return { kind: "bulk", ids };
  }

  if (typeof id !== "number") return { error: "id is required and must be a number" };
  return { kind: "single", id };
}
