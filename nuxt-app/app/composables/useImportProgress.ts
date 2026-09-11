import { onScopeDispose, ref } from "vue";
import { readImportStream, type ImportProgress } from "../utils/importStream";

export function useImportProgress() {
  const progress = ref<ImportProgress | null>(null);
  const revision = ref(0);
  let controller: AbortController | undefined;

  function cancel() {
    controller?.abort();
    controller = undefined;
  }

  async function run<T>(url: string, body?: object): Promise<T> {
    cancel();
    const request = new AbortController();
    controller = request;
    progress.value = null;
    revision.value = 0;
    try {
      const response = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: { accept: "application/x-ndjson", ...(body ? { "content-type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: request.signal,
      });
      return await readImportStream<T>(response, (update) => {
        if (controller !== request) return;
        progress.value = update;
        revision.value += 1;
      }, request.signal);
    } finally {
      if (controller === request) controller = undefined;
    }
  }

  onScopeDispose(cancel);
  return { progress, revision, run, cancel };
}
