import { existsSync, unlinkSync } from "node:fs";
import { getCardWithDetails, updateCard } from "../../utils/cards.ts";
import { buildDownloadBaseName, downloadMediaFile } from "../../utils/mediaDownload.ts";
import { getDefaultDownloadFolder } from "../../utils/mediaLibrary.ts";

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

  const downloadResult = await downloadMediaFile(sourceUrl, destDir, baseName, ext);
  if ("error" in downloadResult) {
    throw createError({ statusCode: 502, statusMessage: downloadResult.error });
  }

  const updateResult = updateCard(
    kind === "video"
      ? { id: card.id, localVideoPath: downloadResult.path }
      : { id: card.id, localAudioPath: downloadResult.path },
  );
  if ("error" in updateResult || "notFound" in updateResult) {
    if (existsSync(downloadResult.path)) unlinkSync(downloadResult.path);
    throw createError({ statusCode: 500, statusMessage: "Downloaded the file but failed to save it to the card." });
  }

  return updateResult.card;
});
