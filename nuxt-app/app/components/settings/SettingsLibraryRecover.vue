<script setup lang="ts">
type ClipKind = "video" | "audio";

// Client copies of server/utils/libraryScan.ts, same field order.
interface ScanSong {
  songId: number;
  songTitle: string;
  animeTitleRomaji: string;
  themeSlot: string;
  artistName: string;
}

interface RecoverCreate extends ScanSong {
  videoPath: string | null;
  audioPath: string | null;
}

interface RecoverAttach extends ScanSong {
  cardId: number;
  kind: ClipKind;
  path: string;
}

interface RecoverSkip {
  path: string;
  reason: "duplicate" | "unmatched" | "ambiguous";
  songTitle: string | null;
}

interface LibraryScanResponse {
  scannedFiles: number;
  alreadyUsed: number;
  create: RecoverCreate[];
  attach: RecoverAttach[];
  skipped: RecoverSkip[];
  unreadableFolders: string[];
  truncated: boolean;
}

interface RecoverResult {
  created: number;
  attached: number;
  skipped: string[];
}

const scan = ref<LibraryScanResponse | null>(null);
const isScanning = ref(false);
const isApplying = ref(false);
const scanError = ref<string | null>(null);
const applyError = ref<string | null>(null);
const result = ref<RecoverResult | null>(null);

const duplicates = computed(() => scan.value?.skipped.filter((s) => s.reason === "duplicate") ?? []);
const unmatched = computed(() => scan.value?.skipped.filter((s) => s.reason !== "duplicate") ?? []);
const actionCount = computed(() => (scan.value ? scan.value.create.length + scan.value.attach.length : 0));

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

async function runScan() {
  scanError.value = null;
  isScanning.value = true;
  try {
    scan.value = await $fetch<LibraryScanResponse>("/api/cards/recover");
  } catch (err) {
    scanError.value = extractErrorMessage(err, "Couldn't scan the library folders.");
  } finally {
    isScanning.value = false;
  }
}

async function apply() {
  if (!scan.value) return;
  const paths = [
    ...scan.value.create.flatMap((c) => [c.videoPath, c.audioPath].filter((p): p is string => p !== null)),
    ...scan.value.attach.map((a) => a.path),
  ];
  applyError.value = null;
  result.value = null;
  isApplying.value = true;
  try {
    result.value = await $fetch<RecoverResult>("/api/cards/recover", { method: "POST", body: { paths } });
    await runScan();
  } catch (err) {
    applyError.value = extractErrorMessage(err, "Couldn't add cards from these files.");
  } finally {
    isApplying.value = false;
  }
}

const resultText = computed(() => {
  if (!result.value) return null;
  const parts = [`Added ${plural(result.value.created, "card")}`, `attached ${plural(result.value.attached, "file")}`];
  if (result.value.skipped.length) parts.push(`${plural(result.value.skipped.length, "file")} changed since the scan and were left alone`);
  return `${parts.join(", ")}.`;
});
</script>

<template>
  <div class="recover">
    <div class="recover-header">
      <span class="recover-title">Recover cards from files</span>
      <span class="recover-hint">
        Find clips in your library folders that no card uses, matched by filename to songs you added before.
        Scanning changes nothing.
      </span>
    </div>

    <div class="recover-actions">
      <button type="button" class="recover-btn" :disabled="isScanning || isApplying" @click="runScan">
        {{ isScanning ? "Scanning..." : scan ? "Scan again" : "Scan folders" }}
      </button>
      <p v-if="scanError" class="control-error">{{ scanError }}</p>
    </div>

    <p v-if="resultText" class="recover-summary recover-summary-done">{{ resultText }}</p>

    <template v-if="scan">
      <ul v-if="scan.unreadableFolders.length || scan.truncated" class="recover-notes">
        <li v-for="folder in scan.unreadableFolders" :key="folder">
          Couldn't read <span class="recover-path">{{ folder }}</span>. If it is on an external drive, connect it and scan again.
        </li>
        <li v-if="scan.truncated">Stopped after {{ scan.scannedFiles }} files. Some files were not checked.</li>
      </ul>

      <p v-if="!scan.scannedFiles" class="recover-summary">No video or audio files found in your library folders.</p>
      <p v-else class="recover-summary">
        {{ plural(scan.scannedFiles, "file") }} found, {{ scan.alreadyUsed }} already used by a card.
        <template v-if="!actionCount"> Nothing to recover.</template>
      </p>

      <template v-if="actionCount">
        <div class="recover-confirm">
          <button type="button" class="recover-btn recover-btn-primary" :disabled="isApplying || isScanning" @click="apply">
            {{ isApplying ? "Adding..." : `Add ${plural(scan.create.length, "card")}${scan.attach.length ? `, attach ${plural(scan.attach.length, "file")}` : ""}` }}
          </button>
          <span class="recover-hint">New cards start at box 1.</span>
        </div>
        <p v-if="applyError" class="control-error">{{ applyError }}</p>
      </template>

      <section v-if="scan.create.length" class="recover-group">
        <h3 class="recover-group-title">Will add ({{ scan.create.length }})</h3>
        <ul class="recover-list">
          <li v-for="entry in scan.create" :key="entry.songId" class="recover-row">
            <span class="recover-song">{{ entry.songTitle }}</span>
            <span class="recover-meta">{{ entry.animeTitleRomaji }} · {{ entry.themeSlot }} · {{ entry.artistName }}</span>
            <span v-if="entry.videoPath" class="recover-path">Video: {{ fileName(entry.videoPath) }}</span>
            <span v-if="entry.audioPath" class="recover-path">Audio: {{ fileName(entry.audioPath) }}</span>
          </li>
        </ul>
      </section>

      <section v-if="scan.attach.length" class="recover-group">
        <h3 class="recover-group-title">Will attach to an existing card ({{ scan.attach.length }})</h3>
        <ul class="recover-list">
          <li v-for="entry in scan.attach" :key="entry.path" class="recover-row">
            <span class="recover-song">{{ entry.songTitle }}</span>
            <span class="recover-meta">{{ entry.animeTitleRomaji }} · {{ entry.themeSlot }} · {{ entry.artistName }}</span>
            <span class="recover-path">As its local {{ entry.kind }}: {{ fileName(entry.path) }}</span>
          </li>
        </ul>
      </section>

      <details v-if="unmatched.length" class="recover-group">
        <summary class="recover-group-title">No matching song ({{ unmatched.length }})</summary>
        <p class="recover-hint">
          These songs aren't in the app yet. Add them from <NuxtLink to="/cards">Cards</NuxtLink> search, then scan again
          to attach these files.
        </p>
        <ul class="recover-list">
          <li v-for="entry in unmatched" :key="entry.path" class="recover-row">
            <span class="recover-path">
              {{ fileName(entry.path) }}<template v-if="entry.reason === 'ambiguous'"> (matches more than one song)</template>
            </span>
          </li>
        </ul>
      </details>

      <details v-if="duplicates.length" class="recover-group">
        <summary class="recover-group-title">Duplicates, left alone ({{ duplicates.length }})</summary>
        <p class="recover-hint">The card for this song already has its own file of this kind.</p>
        <ul class="recover-list">
          <li v-for="entry in duplicates" :key="entry.path" class="recover-row">
            <span class="recover-path">{{ fileName(entry.path) }}</span>
          </li>
        </ul>
      </details>
    </template>
  </div>
</template>

<style scoped>
.recover {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.recover-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.recover-title {
  font-weight: 900;
  font-size: 15px;
}

.recover-hint {
  margin: 0;
  font-size: 12px;
  color: var(--faint);
}

.recover-hint a {
  color: var(--accent);
}

.recover-actions,
.recover-confirm {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.recover-btn {
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

.recover-btn-primary {
  border-color: var(--accent);
  color: var(--accent);
}

.recover-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.recover-summary {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.recover-summary-done {
  color: var(--pass);
}

.recover-notes {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--warning);
  font-size: 13px;
}

.recover-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.recover-group-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  cursor: default;
}

summary.recover-group-title {
  cursor: pointer;
}

.recover-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}

.recover-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
  min-width: 0;
}

.recover-song {
  font-weight: 700;
}

.recover-meta {
  font-size: 12px;
  color: var(--faint);
}

.recover-path {
  font-size: 12px;
  color: var(--faint);
  overflow-wrap: anywhere;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
