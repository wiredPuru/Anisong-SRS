export interface ImportOneResult {
  title: string;
  added: number;
  alreadyAdded: number;
  skipped: number;
  // Only present when the import ran with a deck target.
  addedToDeck?: number;
}

export interface ImportBatchProgress {
  done: number;
  total: number;
  added: number;
  addedToDeck: number;
  failed: number;
  empty: number;
  current: string | null;
}

export interface ImportBatchResult extends ImportBatchProgress {
  cancelled: boolean;
}

/** Imports anime one at a time; a failure is counted and skipped, never fatal. */
export async function importAnimeBatch(
  aniListIds: number[],
  importOne: (aniListId: number) => Promise<ImportOneResult>,
  options: { shouldStop?: () => boolean; onProgress?: (progress: ImportBatchProgress) => void } = {},
): Promise<ImportBatchResult> {
  const progress: ImportBatchProgress = { done: 0, total: aniListIds.length, added: 0, addedToDeck: 0, failed: 0, empty: 0, current: null };
  let cancelled = false;
  for (const aniListId of aniListIds) {
    if (options.shouldStop?.()) {
      cancelled = true;
      break;
    }
    progress.current = `#${aniListId}`;
    options.onProgress?.({ ...progress });
    try {
      const result = await importOne(aniListId);
      progress.current = result.title;
      progress.added += result.added;
      progress.addedToDeck += result.addedToDeck ?? 0;
      if (result.added + result.alreadyAdded === 0) progress.empty += 1;
    } catch {
      progress.failed += 1;
    }
    progress.done += 1;
    options.onProgress?.({ ...progress });
  }
  progress.current = null;
  return { ...progress, cancelled };
}
