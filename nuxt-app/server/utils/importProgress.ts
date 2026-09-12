import { PassThrough } from "node:stream";
import { getRequestHeader, sendStream, setResponseHeader, type H3Event } from "h3";
import { ProviderUnavailableError } from "../lib/graphql.ts";

export interface ImportProgress {
  label: string;
  completed?: number;
  total?: number;
  skipped?: number;
  unavailable?: number;
}

export type ReportImportProgress = (progress: ImportProgress) => void;

export function createImportStream<T>(run: (report: ReportImportProgress) => Promise<T>) {
  const stream = new PassThrough();
  const write = (event: object) => {
    if (stream.destroyed) throw new Error("Import connection closed.");
    stream.write(`${JSON.stringify(event)}\n`);
  };

  void Promise.resolve().then(() => run((progress) => {
    write({ type: progress.completed === undefined ? "stage" : "progress", ...progress });
  })).then((result) => {
    if (!stream.destroyed) write({ type: "done", result });
  }).catch((error: unknown) => {
    if (stream.destroyed) return;
    const message = error instanceof Error && "statusMessage" in error && typeof error.statusMessage === "string"
      ? error.statusMessage : "Import failed. Please try again.";
    // Flagged so the client can tell an upstream outage, which no retry or
    // corrected input will fix, from a failure the user can act on.
    write({ type: "error", message, unavailable: error instanceof ProviderUnavailableError });
  }).finally(() => stream.end());

  return stream;
}

export function respondWithImportProgress<T>(event: H3Event, run: (report: ReportImportProgress) => Promise<T>) {
  if (!getRequestHeader(event, "accept")?.split(",").some((type) => type.trim() === "application/x-ndjson")) {
    return run(() => {});
  }
  setResponseHeader(event, "content-type", "application/x-ndjson");
  setResponseHeader(event, "cache-control", "no-store");
  return sendStream(event, createImportStream(run));
}
