export const PAGE_SIZE = 25;

export function parsePage(raw: unknown): number {
  const page = Number(raw);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}
