import { existsSync, unlinkSync } from "node:fs";
import { Readable } from "node:stream";
import { getCardWithDetails, updateCard } from "../../utils/cards.ts";
import { buildDownloadBaseName, downloadMediaFile } from "../../utils/mediaDownload.ts";
import { getDefaultDownloadFolder } from "../../utils/mediaLibrary.ts";

async function* streamDownloadResponse(
  sourceUrl: string,
  destDir: string,
  baseName: string,
  ext: string,
  cardId: number,
  kind: "video" | "audio",
): AsyncGenerator<string> {
  for await (const event of downloadMediaFile(sourceUrl, destDir, baseName, ext)) {
    if (event.type === "progress") {
      yield `${JSON.stringify({ type: "progress", loaded: event.loaded, total: event.total })}\n`;
      continue;
    }
    if (event.type === "error") {
      yield `${JSON.stringify({ type: "error", message: event.message })}\n`;
      return;
    }

    const updateResult = updateCard(
      kind === "video" ? { id: cardId, localVideoPath: event.path } : { id: cardId, localAudioPath: event.path },
    );
    if ("error" in updateResult || "notFound" in updateResult) {
      if (existsSync(event.path)) unlinkSync(event.path);
      yield `${JSON.stringify({ type: "error", message: "Downloaded the file but failed to save it to the card." })}\n`;
      return;
    }
    yield `${JSON.stringify({ type: "done", card: updateResult.card })}\n`;
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.cardId !== "number") {
    throw createError({ statusCode: 400, statusMessage: "cardId is required and must be a number" });
  }
  if (body.kind !== "video" && body.kind !== "audio") {
    throw createError({ statusCode: 400, statusMessage: "kind must be 'video' or 'audio'" });
  }

  const kind: "video" | "audio" = body.kind;
  const card = getCardWithDetails(body.cardId);
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

  const destDir = getDefaultDownloadFolder();
  if (!destDir) {
    throw createError({
      statusCode: 400,
      statusMessage: "No default download folder is configured. Set one in Settings.",
    });
  }

  const { baseName, ext } = buildDownloadBaseName({
    animeTitleRomaji: card.animeTitleRomaji,
    themeSlot: card.themeSlot,
    artistName: card.artistName,
    url: sourceUrl,
    kind,
  });

  setResponseHeader(event, "content-type", "application/x-ndjson");
  return sendStream(event, Readable.from(streamDownloadResponse(sourceUrl, destDir, baseName, ext, card.id, kind)));
});
