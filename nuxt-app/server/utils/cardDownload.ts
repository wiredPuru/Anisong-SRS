import { existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { getCardWithDetails, updateCard, type CardWithDetails } from "./cards.ts";
import { assertClipUrlAllowed } from "./clipSourceGuard.ts";
import { acquireDownloadGuard, downloadGuardKey, releaseDownloadGuard } from "./downloadGuard.ts";
import { buildDownloadBaseName, downloadMediaFile } from "./mediaDownload.ts";
import { getDefaultDownloadFolder } from "./mediaLibrary.ts";
import { assertOnline } from "./networkMode.ts";
import { cachedFilePathIfPresent } from "./streamCache.ts";

export type CardDownloadEvent =
  | { type: "progress"; loaded: number; total: number }
  | { type: "error"; message: string; code?: "OFFLINE_MODE" }
  | { type: "done"; card: CardWithDetails };

export interface CardDownloadJob {
  cardId: number;
  kind: "video" | "audio";
  sourceUrl: string;
  destDir: string;
  baseName: string;
  ext: string;
  guardKey: string;
}

function resolveDestDir(): string {
  const destDir = getDefaultDownloadFolder();
  if (!destDir) {
    throw createError({
      statusCode: 400,
      statusMessage: "No default download folder is configured. Set one in Settings.",
    });
  }
  if (existsSync(destDir)) {
    if (!statSync(destDir).isDirectory()) {
      throw createError({
        statusCode: 400,
        statusMessage: "Default download folder path is not a directory. Set a valid folder in Settings.",
      });
    }
  } else {
    mkdirSync(destDir, { recursive: true });
  }
  return destDir;
}

/**
 * Checks a card's download and claims its in-flight guard. Throws an HTTP error
 * for any problem; on success the caller must run the job, which releases the guard.
 */
export function prepareCardDownload(cardId: number, kind: "video" | "audio"): CardDownloadJob {
  const card = getCardWithDetails(cardId);
  if (!card) {
    throw createError({ statusCode: 404, statusMessage: "Card not found" });
  }

  const sourceUrl = kind === "video" ? card.animethemesVideoUrl : card.animethemesAudioUrl;
  const existingLocalPath = kind === "video" ? card.localVideoPath : card.localAudioPath;
  if (!sourceUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: `Card has no animethemes.moe ${kind} reference to download.`,
    });
  }
  if (existingLocalPath) {
    throw createError({
      statusCode: 400,
      statusMessage: `Card already has a local ${kind} file. Clear it first to re-download.`,
    });
  }
  assertClipUrlAllowed(sourceUrl);
  if (!cachedFilePathIfPresent(sourceUrl)) assertOnline();

  // Guards against a concurrent request for the same card+kind (e.g. Auto
  // Download racing a manual/Preview download) that would otherwise also
  // pass the "no local path yet" check above.
  const guardKey = downloadGuardKey(card.id, kind);
  if (!acquireDownloadGuard(guardKey)) {
    throw createError({ statusCode: 409, statusMessage: "A download for this card is already in progress." });
  }

  let destDir: string;
  try {
    destDir = resolveDestDir();
  } catch (err) {
    releaseDownloadGuard(guardKey);
    throw err;
  }

  const { baseName, ext } = buildDownloadBaseName({
    animeTitleRomaji: card.animeTitleRomaji,
    themeSlot: card.themeSlot,
    artistName: card.artistName,
    url: sourceUrl,
    kind,
  });
  return { cardId: card.id, kind, sourceUrl, destDir, baseName, ext, guardKey };
}

/** Downloads the file and saves its path on the card, releasing the job's guard when it settles. */
export async function* runCardDownload(job: CardDownloadJob): AsyncGenerator<CardDownloadEvent> {
  try {
    for await (const event of downloadMediaFile(job.sourceUrl, job.destDir, job.baseName, job.ext)) {
      if (event.type === "progress") {
        yield { type: "progress", loaded: event.loaded, total: event.total };
        continue;
      }
      if (event.type === "error") {
        yield event;
        return;
      }

      const updateResult = updateCard(
        job.kind === "video" ? { id: job.cardId, localVideoPath: event.path } : { id: job.cardId, localAudioPath: event.path },
      );
      if ("error" in updateResult || "notFound" in updateResult) {
        if (existsSync(event.path)) unlinkSync(event.path);
        yield { type: "error", message: "Downloaded the file but failed to save it to the card." };
        return;
      }
      yield { type: "done", card: updateResult.card };
    }
  } finally {
    releaseDownloadGuard(job.guardKey);
  }
}
