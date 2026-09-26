<script setup lang="ts">
import type { CardWithDetails } from "../../composables/useStudySession";

type MediaKind = "video" | "audio";

// Client copy of server/utils/libraryHealth.ts, same field order.
interface CardHealth {
  localIssues: { kind: MediaKind; problem: "missing" | "outsideLibrary"; path: string }[];
  noPlayableSource: boolean;
  redownload: MediaKind[];
  clear: MediaKind[];
  resource: boolean;
}

interface CardHealthRow {
  card: CardWithDetails;
  health: CardHealth;
}

interface LibraryHealthResponse {
  checked: number;
  clipSource: "anisongdb" | "both" | "animethemes";
  hasDefaultDownloadFolder: boolean;
  issues: CardHealthRow[];
}

const scan = ref<LibraryHealthResponse | null>(null);
const isScanning = ref(false);
const scanError = ref<string | null>(null);

const { downloadProgress, downloadError, downloadKey, downloadMedia } = useCardDownloads();

const busy = reactive<Record<number, string | null>>({});
const rowError = reactive<Record<number, string | null>>({});
const rowNote = reactive<Record<number, string | null>>({});
const confirmingDelete = reactive<Record<number, boolean>>({});
// A fix can fail after an earlier part of it already made the card healthy
// (a Re-download whose path was cleared but whose download failed), which
// drops the row; its error is kept here so it isn't lost with the row.
const notices = ref<string[]>([]);
const fixRunning = computed(() => Object.values(busy).some(Boolean));

function resetRowState() {
  for (const state of [busy, rowError, rowNote, confirmingDelete]) {
    for (const key of Object.keys(state)) delete state[Number(key)];
  }
  notices.value = [];
}

async function runScan() {
  scanError.value = null;
  resetRowState();
  isScanning.value = true;
  try {
    scan.value = await $fetch<LibraryHealthResponse>("/api/cards/health");
  } catch (err) {
    scanError.value = extractErrorMessage(err, "Couldn't scan the library.");
  } finally {
    isScanning.value = false;
  }
}

function dropRow(cardId: number) {
  if (!scan.value) return;
  scan.value.issues = scan.value.issues.filter((row) => row.card.id !== cardId);
}

// Every fix ends by asking the server again, so the row shows what is still
// wrong (or disappears) instead of guessing from what the fix meant to do.
async function recheck(cardId: number) {
  if (!scan.value) return;
  const result = await $fetch<LibraryHealthResponse>("/api/cards/health", { query: { cardId } });
  const fresh = result.issues[0];
  if (!fresh) {
    const error = rowError[cardId];
    const row = scan.value.issues.find((r) => r.card.id === cardId);
    if (error && row) notices.value.push(`${row.card.songTitle}: ${error} The card can play now.`);
    dropRow(cardId);
    return;
  }
  scan.value.issues = scan.value.issues.map((row) => (row.card.id === cardId ? fresh : row));
}

async function runFix(cardId: number, label: string, fix: () => Promise<void>) {
  busy[cardId] = label;
  rowError[cardId] = null;
  rowNote[cardId] = null;
  try {
    await fix();
  } catch (err) {
    // A download failure arrives as a plain Error carrying the route's own
    // message, which extractErrorMessage (it reads $fetch's data) cannot see.
    rowError[cardId] = err instanceof Error && !("data" in err)
      ? err.message
      : extractErrorMessage(err, "That fix didn't work.");
  }
  try {
    await recheck(cardId);
  } catch {
    // The fix's own outcome is already on the row; a failed re-check only
    // means the row may be stale until the next scan.
  } finally {
    busy[cardId] = null;
  }
}

async function clearPath(cardId: number, kind: MediaKind) {
  const body = kind === "video" ? { id: cardId, localVideoPath: null } : { id: cardId, localAudioPath: null };
  await $fetch("/api/cards", { method: "PATCH", body });
}

// The download route refuses to write over a set path, so the stale one is
// cleared first.
function redownload(row: CardHealthRow, kind: MediaKind) {
  const cardId = row.card.id;
  return runFix(cardId, `Re-downloading ${kind}`, async () => {
    await clearPath(cardId, kind);
    const card = await downloadMedia<CardWithDetails>(cardId, cardId, kind);
    if (!card) throw new Error(downloadError[cardId] ?? "Failed to download the file.");
  });
}

function clear(row: CardHealthRow, kind: MediaKind) {
  return runFix(row.card.id, `Clearing ${kind}`, () => clearPath(row.card.id, kind));
}

// Re-source only rewrites a kind whose local path is empty, so a missing file
// backed by a remote link is cleared first. That link keeps the card valid.
function resource(row: CardHealthRow) {
  const cardId = row.card.id;
  return runFix(cardId, "Re-sourcing", async () => {
    for (const issue of row.health.localIssues) {
      const remote = issue.kind === "video" ? row.card.animethemesVideoUrl : row.card.animethemesAudioUrl;
      if (issue.problem === "missing" && remote) await clearPath(cardId, issue.kind);
    }
    const result = await $fetch<{ updated: boolean }>("/api/cards/resource", { method: "POST", body: { cardId } });
    if (!result.updated) rowNote[cardId] = "No faster source found.";
  });
}

async function deleteCard(row: CardHealthRow) {
  const cardId = row.card.id;
  confirmingDelete[cardId] = false;
  busy[cardId] = "Deleting";
  rowError[cardId] = null;
  try {
    await $fetch("/api/cards", { method: "DELETE", body: { id: cardId } });
    dropRow(cardId);
    if (scan.value) scan.value.checked -= 1;
  } catch (err) {
    rowError[cardId] = extractErrorMessage(err, "Couldn't delete this card.");
  } finally {
    busy[cardId] = null;
  }
}

function progressText(cardId: number, label: string): string {
  const kind: MediaKind = label.endsWith("audio") ? "audio" : "video";
  const progress = downloadProgress[downloadKey(cardId, kind)];
  return label.startsWith("Re-downloading") ? `${label}: ${formatDownloadProgress(progress)}` : `${label}...`;
}

const KIND_LABEL: Record<MediaKind, string> = { video: "video", audio: "audio" };

function problemText(issue: CardHealth["localIssues"][number]): string {
  return issue.problem === "missing"
    ? `Local ${KIND_LABEL[issue.kind]} file is missing`
    : `Local ${KIND_LABEL[issue.kind]} is outside your media library folders`;
}

const hasOutsideLibrary = computed(() =>
  scan.value?.issues.some((row) => row.health.localIssues.some((i) => i.problem === "outsideLibrary")) ?? false);
const hasMissing = computed(() =>
  scan.value?.issues.some((row) => row.health.localIssues.some((i) => i.problem === "missing")) ?? false);
</script>

<template>
  <div class="health">
    <div class="health-header">
      <span class="health-title">Library health</span>
      <span class="health-hint">Find cards that can't play, and fix them one at a time. Scanning changes nothing.</span>
    </div>

    <div class="health-actions">
      <button type="button" class="health-btn" :disabled="isScanning || fixRunning" @click="runScan">
        {{ isScanning ? "Scanning..." : scan ? "Scan again" : "Scan library" }}
      </button>
      <p v-if="scanError" class="control-error">{{ scanError }}</p>
    </div>

    <p v-for="notice in notices" :key="notice" class="control-error">{{ notice }}</p>

    <template v-if="scan">
      <p v-if="!scan.checked" class="health-summary">No cards yet.</p>
      <p v-else-if="!scan.issues.length" class="health-summary health-summary-clear">
        All {{ scan.checked }} cards can play.
      </p>
      <template v-else>
        <p class="health-summary">
          {{ scan.issues.length }} of {{ scan.checked }} cards need attention.
        </p>

        <ul class="health-notes">
          <li v-if="hasMissing">
            A missing file on an external or network drive may only be unplugged. Reconnect it and scan again
            before clearing anything.
          </li>
          <li v-if="hasOutsideLibrary">
            A file outside your library folders still exists. Add its folder in
            <NuxtLink to="/settings?section=library">Media library</NuxtLink> so the app can read it.
          </li>
          <li v-if="!scan.hasDefaultDownloadFolder">
            Set a default download folder in <NuxtLink to="/settings?section=library">Media library</NuxtLink>
            to re-download missing files.
          </li>
        </ul>

        <ul class="health-list">
          <li v-for="row in scan.issues" :key="row.card.id" class="health-row">
            <img v-if="row.card.animeCoverImageUrl" :src="row.card.animeCoverImageUrl" alt="" class="cover-thumb" />
            <span v-else class="cover-thumb cover-thumb-empty" />

            <div class="health-row-body">
              <span class="health-row-song">{{ row.card.songTitle }}</span>
              <span class="health-row-meta">
                {{ row.card.animeTitleRomaji }} · {{ row.card.themeSlot }} · {{ row.card.artistName }}
              </span>
              <ul class="health-problems">
                <li v-for="issue in row.health.localIssues" :key="issue.kind">
                  {{ problemText(issue) }}
                  <span class="health-path">{{ issue.path }}</span>
                </li>
                <li v-if="row.health.noPlayableSource">No source the Clip source setting allows</li>
              </ul>

              <p v-if="busy[row.card.id]" class="health-busy">{{ progressText(row.card.id, busy[row.card.id]!) }}</p>
              <div v-else class="health-fixes">
                <button
                  v-for="kind in row.health.redownload"
                  :key="`redownload-${kind}`"
                  type="button"
                  class="fix-btn"
                  @click="redownload(row, kind)"
                >
                  Re-download {{ kind }}
                </button>
                <button
                  v-for="kind in row.health.clear"
                  :key="`clear-${kind}`"
                  type="button"
                  class="fix-btn"
                  @click="clear(row, kind)"
                >
                  Clear {{ kind }} path
                </button>
                <button v-if="row.health.resource" type="button" class="fix-btn" @click="resource(row)">
                  Re-source
                </button>
                <template v-if="confirmingDelete[row.card.id]">
                  <span class="health-confirm">Delete this card from the library?</span>
                  <button type="button" class="fix-btn fix-btn-danger" @click="deleteCard(row)">Delete</button>
                  <button type="button" class="fix-btn" @click="confirmingDelete[row.card.id] = false">Cancel</button>
                </template>
                <button v-else type="button" class="fix-btn fix-btn-danger" @click="confirmingDelete[row.card.id] = true">
                  Delete
                </button>
              </div>
              <p v-if="rowNote[row.card.id]" class="health-note">{{ rowNote[row.card.id] }}</p>
              <p v-if="rowError[row.card.id]" class="control-error">{{ rowError[row.card.id] }}</p>
            </div>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>

<style scoped>
.health {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.health-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.health-title {
  font-weight: 900;
  font-size: 15px;
}

.health-hint {
  font-size: 12px;
  color: var(--faint);
}

.health-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.health-btn {
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent-secondary);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.health-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.health-summary {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.health-summary-clear {
  color: var(--pass);
}

.health-notes {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--muted);
  font-size: 13px;
}

.health-notes a {
  color: var(--accent);
}

.health-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}

.health-row {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--border);
}

.cover-thumb {
  flex: none;
  width: 34px;
  height: 48px;
  border-radius: var(--radius-xs);
  object-fit: cover;
}

.cover-thumb-empty {
  display: block;
  background: var(--surface-raised);
}

.health-row-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.health-row-song {
  font-weight: 700;
}

.health-row-meta {
  font-size: 12px;
  color: var(--faint);
}

.health-problems {
  margin: 4px 0 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--warning);
}

.health-path {
  display: block;
  color: var(--faint);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.health-fixes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.fix-btn {
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.fix-btn:hover {
  border-color: var(--accent-secondary);
}

.fix-btn-danger {
  color: var(--fail);
}

.fix-btn-danger:hover {
  border-color: var(--fail);
}

.health-confirm {
  font-size: 13px;
  color: var(--fail);
}

.health-busy,
.health-note {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
