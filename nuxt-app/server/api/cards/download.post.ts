import { Readable } from "node:stream";
import { prepareCardDownload, runCardDownload, type CardDownloadJob } from "../../utils/cardDownload.ts";

async function* streamDownloadResponse(job: CardDownloadJob): AsyncGenerator<string> {
  for await (const event of runCardDownload(job)) yield `${JSON.stringify(event)}\n`;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.cardId !== "number") {
    throw createError({ statusCode: 400, statusMessage: "cardId is required and must be a number" });
  }
  if (body.kind !== "video" && body.kind !== "audio") {
    throw createError({ statusCode: 400, statusMessage: "kind must be 'video' or 'audio'" });
  }

  const job = prepareCardDownload(body.cardId, body.kind);
  setResponseHeader(event, "content-type", "application/x-ndjson");
  return sendStream(event, Readable.from(streamDownloadResponse(job)));
});
