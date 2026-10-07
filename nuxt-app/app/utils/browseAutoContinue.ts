// The deck window lists only AniList shows the library lacks, and the most
// popular matches are usually already owned, so a page can add few or none.
// Rather than leave a short list stranded behind a scroll that never fires,
// it keeps loading pages until enough turn up, within a page budget that
// keeps the number of AniList requests bounded.
export const MIN_UNOWNED_SHOWS = 20;
export const MAX_SCANNED_PAGES = 10;

export function needsMorePages(unownedCount: number, hasNextPage: boolean, pagesScanned: number): boolean {
  return hasNextPage && unownedCount < MIN_UNOWNED_SHOWS && pagesScanned < MAX_SCANNED_PAGES;
}
