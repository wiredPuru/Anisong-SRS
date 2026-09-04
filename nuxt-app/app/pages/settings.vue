<script setup lang="ts">
const { data, pending, error, refresh } = await useFetch<{
  libraryPaths: string[];
  defaultDownloadFolder: string | null;
  dailyNewCardLimit: number | null;
  boxOneStreakRequired: number;
  streamCacheMaxBytes: number;
  streamCachePath: string;
  playbackMode: "auto" | "audioOnly";
}>("/api/media-library");

type SettingsSection = "library" | "study" | "playback" | "cache" | "import" | "about";

const SECTIONS: SettingsSection[] = ["library", "study", "playback", "cache", "import", "about"];
const SECTION_LABELS: Record<SettingsSection, string> = {
  library: "Media library",
  study: "Study pacing",
  playback: "Playback",
  cache: "Cache",
  import: "Import & export",
  about: "About",
};

const appVersion = useRuntimeConfig().public.appVersion;
const { status: updateStatus, pending: updatePending, check: checkForUpdate } = useUpdateCheck();
onMounted(() => checkForUpdate());

function parseSection(value: unknown): SettingsSection {
  return SECTIONS.includes(value as SettingsSection) ? (value as SettingsSection) : "library";
}

const route = useRoute();
const router = useRouter();

const activeSection = ref<SettingsSection>(parseSection(route.query.section));

watch(
  () => route.query.section,
  (section) => {
    activeSection.value = parseSection(section);
  },
);

function setSection(section: SettingsSection) {
  router.push({ query: { section } });
}

const newPath = ref("");
const addError = ref<string | null>(null);
const isAdding = ref(false);
const isSettingDefault = ref(false);
const defaultFolderError = ref<string | null>(null);
const removeFolderError = ref<string | null>(null);

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
  removeFolderError.value = null;
  try {
    await $fetch("/api/media-library/folders", { method: "DELETE", body: { path } });
    await refresh();
  } catch (err) {
    removeFolderError.value = extractErrorMessage(err, "Failed to remove folder.");
  }
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
    <nav class="section-rail" aria-label="Settings sections">
      <button
        v-for="section in SECTIONS"
        :key="section"
        type="button"
        class="section-rail-item"
        :class="{ active: activeSection === section }"
        @click="setSection(section)"
      >
        {{ SECTION_LABELS[section] }}
      </button>
    </nav>

    <div class="settings-content">
      <header class="settings-header">
        <span class="settings-header-title">{{ SECTION_LABELS[activeSection] }}</span>
        <span class="settings-header-hint">Changes save as you go</span>
      </header>

      <div class="settings-body">
        <!-- Deliberately outside the settings fetch below: the running version
             is exactly what you want readable when settings fail to load. -->
        <div v-if="activeSection === 'about'" class="section-panels">
          <div class="panel panel-full">
            <div class="panel-header">
              <span class="panel-title">Version</span>
              <span class="panel-hint">This copy of GAQ SRS, and whether a newer release exists.</span>
            </div>

            <p class="version-line">{{ updateStatus?.current ?? appVersion }}</p>

            <p v-if="updatePending" class="state">Checking for updates...</p>
            <a
              v-else-if="updateStatus?.updateAvailable && updateStatus.releaseUrl"
              :href="updateStatus.releaseUrl"
              target="_blank"
              rel="noreferrer"
              class="update-link"
            >
              Update available - {{ updateStatus.latest }}
            </a>
            <p v-else-if="updateStatus && !updateStatus.checkFailed" class="version-hint">
              You're up to date.
            </p>
            <p v-else class="version-hint">Couldn't check for updates.</p>

            <button
              type="button"
              class="add-btn version-check-btn"
              :disabled="updatePending"
              @click="checkForUpdate(true)"
            >
              Check again
            </button>
          </div>
        </div>

        <template v-else>
        <div v-if="pending" class="state">Loading...</div>
        <div v-else-if="error" class="state state-error">Couldn't load settings. Try refreshing.</div>
        <template v-else-if="data">
          <div class="section-panels">
            <template v-if="activeSection === 'library'">
              <div class="panel panel-full">
                <div class="panel-header">
                  <span class="panel-title">Local folders</span>
                  <span class="panel-hint">Folders the app looks in for local anime clips.</span>
                </div>
                <ul v-if="data.libraryPaths.length" class="folder-list">
                  <li v-for="path in data.libraryPaths" :key="path" class="folder-row">
                    <span class="path">{{ path }}</span>
                    <button type="button" class="remove-btn" @click="removeFolder(path)">Remove</button>
                  </li>
                </ul>
                <p v-else class="state">No folders configured yet.</p>
                <p v-if="removeFolderError" class="add-error">{{ removeFolderError }}</p>

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
              </div>

              <div class="panel">
                <div class="panel-header">
                  <span class="panel-title">Downloads</span>
                </div>
                <div v-if="data.libraryPaths.length === 1" class="state download-folder-note">
                  Downloads will go to <span class="path">{{ data.libraryPaths[0] }}</span>.
                </div>
                <div v-else-if="data.libraryPaths.length > 1" class="download-folder-picker">
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
                <p v-else class="state">Add a folder to configure downloads.</p>
              </div>
            </template>

            <template v-else-if="activeSection === 'study'">
              <p class="section-hint">
                Pace how many never-studied cards get introduced per day, and how many correct answers a new card
                needs before it graduates.
              </p>
              <SettingsNewCardLimitControl :limit="data.dailyNewCardLimit" @saved="refresh" />
              <SettingsBoxOneStreakControl :required="data.boxOneStreakRequired" @saved="refresh" />
            </template>

            <template v-else-if="activeSection === 'playback'">
              <p class="section-hint">
                Audio only plays every card from its audio source when one exists, and stops the streamed-clip cache
                from fetching or storing video - useful to save local storage. Takes effect starting with the next
                card; changing it here never affects a card already playing.
              </p>
              <SettingsPlaybackModeControl :mode="data.playbackMode" @saved="refresh" />
            </template>

            <template v-else-if="activeSection === 'cache'">
              <p class="section-hint">
                Remote clips are cached to disk after they're played, up to this size, so replaying them doesn't
                re-fetch from the CDN.
              </p>
              <SettingsStreamCacheSizeControl
                :max-bytes="data.streamCacheMaxBytes"
                :path="data.streamCachePath"
                @saved="refresh"
              />
            </template>

            <template v-else-if="activeSection === 'import'">
              <div class="panel panel-full">
                <div class="panel-header">
                  <span class="panel-title">Import deck</span>
                  <span class="panel-hint">
                    Recreate cards from a bundle written by an "Export deck" action on
                    <NuxtLink to="/decks">/decks</NuxtLink>.
                  </span>
                </div>
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
              </div>
            </template>
          </div>
        </template>
        </template>
      </div>
    </div>
  </main>
</template>

<style scoped>
.settings {
  flex: 1;
  min-height: 0;
  display: flex;
}

.section-rail {
  flex: none;
  width: 210px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 22px 14px;
  background: var(--surface-sunken);
  border-right: 1px solid var(--border);
}

.section-rail-item {
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

/* Border and glow, never a fill - main.css's ambient-glass block strips
   backgrounds via !important elsewhere in the app, which would leave
   --accent-ink (near black) text on dark glass. Matched here for
   consistency even though /settings has no ambient mode of its own. */
.section-rail-item.active {
  background: var(--surface-raised);
  color: var(--accent);
  border: 1px solid var(--accent);
  box-shadow: 0 0 14px var(--accent-glow);
}

.settings-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.settings-header {
  flex: none;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 28px;
  background: var(--surface-sunken);
  border-bottom: 1px solid var(--border);
}

.settings-header-title {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 400;
  line-height: 1;
}

.settings-header-hint {
  font-size: 13px;
  color: var(--faint);
}

.settings-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 28px 28px;
}

.section-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  align-content: start;
}

.panel {
  padding: 20px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-full {
  grid-column: 1 / -1;
}

.section-hint {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  font-weight: 900;
  font-size: 15px;
}

.panel-hint {
  font-size: 12px;
  color: var(--faint);
}

.state {
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--muted);
}

.version-line {
  font-size: 22px;
  font-family: var(--font-sans);
  color: var(--text);
}

.version-hint {
  font-size: 13px;
  color: var(--faint);
}

.update-link {
  align-self: flex-start;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--accent);
  color: var(--accent);
  font-size: 13px;
  text-decoration: none;
}

.version-check-btn {
  align-self: flex-start;
}

.update-link:hover {
  background: var(--accent);
  color: var(--accent-ink);
}

.state-error {
  color: var(--accent-strong);
  border-color: var(--accent-strong);
}

.folder-list {
  list-style: none;
  margin: 0;
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
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
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
  border: 1px solid var(--accent-strong);
  background: transparent;
  color: var(--accent-strong);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.add-form {
  display: flex;
  gap: 10px;
}

.path-input {
  flex: 1;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.path-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.add-btn {
  flex: none;
  padding: 11px 20px;
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
  margin: 0;
  color: var(--accent-strong);
  font-size: 13px;
}

.download-folder-note {
  margin: 0;
}

.download-folder-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.download-folder-picker label {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.download-folder-select {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.download-folder-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.import-summary {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.import-error-list {
  margin: 0;
  padding-left: 20px;
  color: var(--accent-strong);
  font-size: 13px;
}

/* 50h: the one page-specific narrow treatment in this pass (everywhere else
   reuses .study-grid's stacking pattern exactly). A 210px vertical rail
   stacked *above* the content pane would push every panel below the fold on
   a short window, so it becomes a horizontal scrollable strip instead -
   same "collapse to a strip" spirit as the icon rail. Placed last so it
   wins the source-order tiebreak over the earlier same-specificity rules. */
@media (max-width: 820px) {
  .settings {
    flex-direction: column;
  }

  .section-rail {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 12px 14px;
  }

  .section-rail-item {
    flex: none;
    white-space: nowrap;
  }

  .section-panels {
    grid-template-columns: 1fr;
  }
}
</style>
