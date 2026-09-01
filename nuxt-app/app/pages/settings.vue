<script setup lang="ts">
const { data, pending, error, refresh } = await useFetch<{
  libraryPaths: string[];
  defaultDownloadFolder: string | null;
  dailyNewCardLimit: number | null;
  boxOneStreakRequired: number;
  streamCacheMaxBytes: number;
  playbackMode: "auto" | "audioOnly";
}>("/api/media-library");

const newPath = ref("");
const addError = ref<string | null>(null);
const isAdding = ref(false);
const isSettingDefault = ref(false);
const defaultFolderError = ref<string | null>(null);

async function addFolder() {
  const path = newPath.value.trim();
  if (!path) return;

  addError.value = null;
  isAdding.value = true;
  try {
    await $fetch("/api/media-library/folders", { method: "POST", body: { path } });
    newPath.value = "";
    await refresh();
  } catch (err) {
    addError.value = extractErrorMessage(err, "Failed to add folder.");
  } finally {
    isAdding.value = false;
  }
}

async function removeFolder(path: string) {
  await $fetch("/api/media-library/folders", { method: "DELETE", body: { path } });
  await refresh();
}

async function setDefaultDownloadFolder(path: string) {
  defaultFolderError.value = null;
  isSettingDefault.value = true;
  try {
    await $fetch("/api/media-library/default-download-folder", { method: "POST", body: { path } });
    await refresh();
  } catch (err) {
    defaultFolderError.value = extractErrorMessage(err, "Failed to set default download folder.");
  } finally {
    isSettingDefault.value = false;
  }
}

const importPath = ref("");
const isImporting = ref(false);
const importSummary = ref<string | null>(null);
const importErrors = ref<string[]>([]);
const importError = ref<string | null>(null);

async function importDeck() {
  const sourcePath = importPath.value.trim();
  if (!sourcePath) return;

  importSummary.value = null;
  importErrors.value = [];
  importError.value = null;
  isImporting.value = true;
  try {
    const result = await $fetch<{ created: number; skipped: number; errors: string[] }>("/api/decks/import", {
      method: "POST",
      body: { sourcePath },
    });
    importSummary.value = `Imported ${result.created} card${result.created === 1 ? "" : "s"} (${result.skipped} skipped)`;
    importErrors.value = result.errors;
  } catch (err) {
    importError.value = extractErrorMessage(err, "Failed to import deck.");
  } finally {
    isImporting.value = false;
  }
}
</script>

<template>
  <main class="settings">
    <h1>Media library</h1>
    <p class="hint">Folders the app will look in for local anime clips.</p>

    <div v-if="pending" class="state">Loading...</div>
    <div v-else-if="error" class="state state-error">Couldn't load settings. Try refreshing.</div>
    <template v-else>
      <ul v-if="data?.libraryPaths.length" class="folder-list">
        <li v-for="path in data.libraryPaths" :key="path" class="folder-row">
          <span class="path">{{ path }}</span>
          <button type="button" class="remove-btn" @click="removeFolder(path)">Remove</button>
        </li>
      </ul>
      <p v-else class="state">No folders configured yet.</p>

      <div v-if="data?.libraryPaths.length === 1" class="state download-folder-note">
        Downloads will go to <span class="path">{{ data.libraryPaths[0] }}</span>.
      </div>
      <div v-else-if="data && data.libraryPaths.length > 1" class="download-folder-picker">
        <label for="download-folder-select">Default download folder</label>
        <select
          id="download-folder-select"
          class="download-folder-select"
          :disabled="isSettingDefault"
          :value="data.defaultDownloadFolder ?? ''"
          @change="setDefaultDownloadFolder(($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>Choose a folder...</option>
          <option v-for="path in data.libraryPaths" :key="path" :value="path">{{ path }}</option>
        </select>
        <p v-if="defaultFolderError" class="add-error">{{ defaultFolderError }}</p>
      </div>
    </template>

    <form class="add-form" @submit.prevent="addFolder">
      <input
        v-model="newPath"
        type="text"
        placeholder="/path/to/anime/clips"
        :disabled="isAdding"
        class="path-input"
      />
      <button type="submit" class="add-btn" :disabled="isAdding">Add folder</button>
    </form>
    <p v-if="addError" class="add-error">{{ addError }}</p>

    <h2>Import deck</h2>
    <p class="hint">Recreate cards from a bundle written by an "Export deck" action on <NuxtLink to="/decks">/decks</NuxtLink>.</p>
    <form class="add-form" @submit.prevent="importDeck">
      <input
        v-model="importPath"
        type="text"
        placeholder="/path/to/exported/deck"
        :disabled="isImporting"
        class="path-input"
      />
      <button type="submit" class="add-btn" :disabled="isImporting || !importPath.trim()">
        {{ isImporting ? "Importing..." : "Import" }}
      </button>
    </form>
    <p v-if="importSummary" class="import-summary">{{ importSummary }}</p>
    <ul v-if="importErrors.length" class="import-error-list">
      <li v-for="(msg, i) in importErrors" :key="i">{{ msg }}</li>
    </ul>
    <p v-if="importError" class="add-error">{{ importError }}</p>

    <h2>Study</h2>
    <p class="hint">Pace how many never-studied cards get introduced per day, and how many correct answers a new card needs before it graduates.</p>
    <div v-if="data" class="study-settings">
      <SettingsNewCardLimitControl :limit="data.dailyNewCardLimit" @saved="refresh" />
      <SettingsBoxOneStreakControl :required="data.boxOneStreakRequired" @saved="refresh" />
    </div>

    <h2>Streamed clip cache</h2>
    <p class="hint">Remote clips are cached to disk after they're played, up to this size, so replaying them doesn't re-fetch from the CDN.</p>
    <div v-if="data" class="study-settings">
      <SettingsStreamCacheSizeControl :max-bytes="data.streamCacheMaxBytes" @saved="refresh" />
    </div>

    <h2>Playback</h2>
    <p class="hint">Audio only plays every card from its audio source when one exists, and stops the streamed-clip cache above from fetching or storing video - useful to save local storage. Takes effect starting with the next card; changing it here never affects a card already playing.</p>
    <div v-if="data" class="study-settings">
      <SettingsPlaybackModeControl :mode="data.playbackMode" @saved="refresh" />
    </div>
  </main>
</template>

<style scoped>
.settings {
  max-width: 640px;
  margin: 0 auto;
  padding: 48px 24px;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 800;
}

.hint {
  margin: 0 0 24px;
  color: var(--muted);
}

.state {
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.state-error {
  color: var(--fail);
  border-color: var(--fail);
}

.folder-list {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.folder-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.path {
  font-family: var(--font-sans);
  word-break: break-all;
}

.remove-btn {
  flex: none;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--fail);
  background: transparent;
  color: var(--fail);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.add-form {
  margin-top: 24px;
  display: flex;
  gap: 10px;
}

.path-input {
  flex: 1;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.path-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.add-btn {
  flex: none;
  padding: 12px 22px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 800;
  cursor: pointer;
}

.add-btn:disabled,
.path-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.add-error {
  margin-top: 10px;
  color: var(--fail);
  font-size: 14px;
}

.download-folder-note {
  margin-bottom: 0;
}

.download-folder-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.download-folder-picker label {
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}

.download-folder-select {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.download-folder-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

h2 {
  margin: 40px 0 8px;
  font-size: 20px;
  font-weight: 800;
}

h2 + .hint {
  margin-bottom: 20px;
}

.import-summary {
  margin-top: 10px;
  color: var(--muted);
  font-size: 14px;
}

.import-error-list {
  margin: 10px 0 0;
  padding-left: 20px;
  color: var(--fail);
  font-size: 14px;
}

.study-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
