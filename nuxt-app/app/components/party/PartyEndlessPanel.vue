<script setup lang="ts">
import type { PartyEndlessDifficulty, PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const LEVELS: { value: PartyEndlessDifficulty; label: string; hint: string }[] = [
  { value: "easy", label: "Easy", hint: "Well-rated, familiar shows (AniList score 75+)." },
  { value: "medium", label: "Medium", hint: "Shows scored 60 to 74." },
  { value: "hard", label: "Hard", hint: "Lower-rated or unrated shows: the deep cuts." },
  { value: "random", label: "Random", hint: "Any show, any score." },
];

const difficulty = ref<PartyEndlessDifficulty>(props.state.endless?.difficulty ?? "easy");
const downloadedOnly = ref(props.state.endless?.downloadedOnly ?? false);
const outsideLibrary = ref(props.state.endless?.outsideLibrary ?? false);
const running = computed(() => props.state.endless !== null);
const hint = computed(() => LEVELS.find((level) => level.value === difficulty.value)?.hint ?? "");

const download = ref<{ partyAutoDownload: boolean; hasDownloadFolder: boolean } | null>(null);
const downloadError = ref<string | null>(null);

onMounted(async () => {
  try {
    download.value = await $fetch("/api/party/host/download-setting");
  } catch {
    download.value = null;
  }
});

async function setDownloadSongs(enabled: boolean) {
  downloadError.value = null;
  try {
    const result = await $fetch<{ partyAutoDownload: boolean }>("/api/party/host/download-setting", { method: "POST", body: { enabled } });
    if (download.value) download.value = { ...download.value, partyAutoDownload: result.partyAutoDownload };
  } catch {
    downloadError.value = "Couldn't save that setting.";
  }
}

function send(config: { difficulty: PartyEndlessDifficulty; downloadedOnly: boolean; outsideLibrary: boolean } | null) {
  emit("command", { type: "endless", config });
}

// While running, a change applies to the songs generated from then on.
function pick(value: PartyEndlessDifficulty) {
  difficulty.value = value;
  if (running.value) send({ difficulty: value, downloadedOnly: downloadedOnly.value, outsideLibrary: outsideLibrary.value });
}

function setDownloaded(value: boolean) {
  downloadedOnly.value = value;
  if (running.value) send({ difficulty: difficulty.value, downloadedOnly: value, outsideLibrary: outsideLibrary.value });
}

function setOutside(value: boolean) {
  outsideLibrary.value = value;
  if (running.value) send({ difficulty: difficulty.value, downloadedOnly: downloadedOnly.value, outsideLibrary: value });
}
</script>

<template>
  <section class="endless" aria-labelledby="endless-title">
    <div class="endless-head">
      <h2 id="endless-title" class="endless-title">Endless playlist</h2>
      <span v-if="running" class="running-chip">Running</span>
    </div>
    <p class="endless-note">
      Keeps adding songs as you play, and holds a show back for a good while once it has played.
    </p>

    <label class="endless-check">
      <input type="checkbox" :checked="outsideLibrary" @change="setOutside(($event.target as HTMLInputElement).checked)" />
      Songs outside my cards and decks
    </label>
    <p class="endless-hint">
      {{ outsideLibrary ? "Random songs from the whole AnisongDB catalog. Difficulty and the downloaded-only filter don't apply." : "Only songs you have cards for." }}
    </p>

    <template v-if="outsideLibrary && download">
      <label class="endless-check">
        <input type="checkbox" :checked="download.partyAutoDownload" @change="setDownloadSongs(($event.target as HTMLInputElement).checked)" />
        Download these songs to my library
      </label>
      <p class="endless-hint">
        {{
          !download.partyAutoDownload
            ? "Songs only stream and may be dropped from the cache."
            : download.hasDownloadFolder
              ? "Each queued song is saved to your default download folder."
              : "Set a default download folder in Settings first, or songs will keep streaming."
        }}
      </p>
      <p v-if="downloadError" class="endless-hint" role="alert">{{ downloadError }}</p>
    </template>

    <div v-if="!outsideLibrary" class="levels" role="radiogroup" aria-label="Difficulty">
      <button
        v-for="level in LEVELS"
        :key="level.value"
        type="button"
        role="radio"
        class="level-pill"
        :class="{ active: difficulty === level.value }"
        :aria-checked="difficulty === level.value"
        @click="pick(level.value)"
      >
        {{ level.label }}
      </button>
    </div>
    <p v-if="!outsideLibrary" class="endless-hint">{{ hint }}</p>

    <label v-if="!outsideLibrary" class="endless-check">
      <input type="checkbox" :checked="downloadedOnly" @change="setDownloaded(($event.target as HTMLInputElement).checked)" />
      Only songs I've downloaded
    </label>
    <p v-if="!outsideLibrary" class="endless-hint">
      {{ downloadedOnly ? "Songs without a local file are skipped." : "Songs that aren't downloaded stream from the clip source." }}
    </p>

    <div class="actions">
      <button v-if="!running" type="button" class="start-btn" @click="send({ difficulty, downloadedOnly, outsideLibrary })">
        {{ state.queue.length ? "Start endless" : "Start endless game" }}
      </button>
      <button v-else type="button" class="stop-btn" @click="send(null)">Stop endless</button>
    </div>
  </section>
</template>

<style scoped>
.endless {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.endless-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.endless-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.running-chip {
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 12px;
  font-weight: 700;
}

.endless-note,
.endless-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.levels,
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.level-pill {
  padding: 6px 14px;
  border: 2px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.level-pill.active {
  border-color: var(--accent);
  color: var(--accent);
}

.endless-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
}

.start-btn,
.stop-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.start-btn {
  background: var(--accent);
  color: var(--accent-ink);
}

.stop-btn {
  background: transparent;
  color: var(--accent);
}
</style>
