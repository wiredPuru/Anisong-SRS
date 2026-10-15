import {
  BULK_DOWNLOAD_KINDS_STORAGE_KEY,
  DEFAULT_BULK_DOWNLOAD_KINDS,
  parseBulkDownloadKinds,
  type BulkDownloadKinds,
} from "../utils/bulkDownloadKinds";

// Shared across every "Download all" and remembered in this browser, so the
// Anime and Artist groups agree and the choice survives a reload.
export function useBulkDownloadKinds() {
  const kinds = useState<BulkDownloadKinds>("bulkDownloadKinds", () => ({ ...DEFAULT_BULK_DOWNLOAD_KINDS }));
  const loaded = useState("bulkDownloadKindsLoaded", () => false);

  onMounted(() => {
    if (loaded.value) return;
    loaded.value = true;
    try {
      kinds.value = parseBulkDownloadKinds(localStorage.getItem(BULK_DOWNLOAD_KINDS_STORAGE_KEY));
    } catch {
      // Storage blocked: keep the default for this visit.
    }
  });

  function setKind(kind: keyof BulkDownloadKinds, on: boolean) {
    kinds.value = { ...kinds.value, [kind]: on };
    try {
      localStorage.setItem(BULK_DOWNLOAD_KINDS_STORAGE_KEY, JSON.stringify(kinds.value));
    } catch {
      // Storage blocked: the choice still applies until the page reloads.
    }
  }

  return { kinds, setKind };
}
