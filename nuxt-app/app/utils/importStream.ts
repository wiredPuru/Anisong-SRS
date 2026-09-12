export interface ImportProgress {
  label: string;
  completed?: number;
  total?: number;
  skipped?: number;
  unavailable?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// An upstream provider outage, as opposed to a failure the user can act on by
// retrying or correcting what they typed.
export function isUnavailable(error: unknown): boolean {
  return error instanceof Error && "unavailable" in error && error.unavailable === true;
}

function importError(message: string, unavailable: unknown): Error {
  return Object.assign(new Error(message), { unavailable: unavailable === true });
}

function parseProgress(value: Record<string, unknown>): ImportProgress {
  if (typeof value.label !== "string" || !value.label.trim()) throw new Error("Invalid import progress.");
  for (const key of ["completed", "total", "skipped", "unavailable"]) {
    if (value[key] !== undefined && (!Number.isSafeInteger(value[key]) || Number(value[key]) < 0)) {
      throw new Error("Invalid import progress count.");
    }
  }
  if (value.total !== undefined && (value.completed === undefined || Number(value.completed) > Number(value.total))) {
    throw new Error("Invalid import progress total.");
  }
  return value as unknown as ImportProgress;
}

export async function readImportStream<T>(
  response: Response,
  onProgress: (progress: ImportProgress) => void,
  signal?: AbortSignal,
): Promise<T> {
  if (!response.ok || !response.body) {
    const body: unknown = await response.json().catch(() => null);
    throw importError(
      isRecord(body) && typeof body.statusMessage === "string" ? body.statusMessage : "Import failed. Please try again.",
      isRecord(body) && body.statusCode === 503,
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;
  let finished = false;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });

  const consume = (line: string) => {
    if (!line.trim()) return;
    if (finished) throw new Error("Unexpected data after import completed.");
    const event: unknown = JSON.parse(line);
    if (!isRecord(event)) throw new Error("Invalid import response.");
    if (event.type === "error") {
      throw importError(typeof event.message === "string" ? event.message : "Import failed. Please try again.", event.unavailable);
    } else if (event.type === "done" && isRecord(event.result)) {
      result = event.result as T;
      finished = true;
    } else if (event.type === "stage" || event.type === "progress") {
      onProgress(parseProgress(event));
    } else throw new Error("Invalid import response.");
  };

  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) consume(line);
      if (done) break;
    }
    consume(buffer);
    if (!finished) throw new Error("Import ended before completion. Please try again.");
    return result as T;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Import response could not be read. Please try again.");
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
