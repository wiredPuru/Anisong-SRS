<script setup lang="ts">
import type { PartyEndless, PartyEndlessDifficulty, PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";
import type { PartyEndlessSource } from "~/components/party/partyEndlessSource";

const props = defineProps<{ state: PartyHostState; source: PartyEndlessSource }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

// Catalog hints name each tier's cells in the popularity x guess-rate grid
// (feature 128b); a song with no guess rate counts as 30-50%.
const LEVELS: { value: PartyEndlessDifficulty; label: string; hint: string; catalogHint: string; catalogOnly?: boolean }[] = [
  {
    value: "veryEasy",
    label: "Very easy",
    hint: "",
    catalogHint: "Top 500 anime, songs at least half of AMQ players get right.",
    catalogOnly: true,
  },
  {
    value: "easy",
    label: "Easy",
    hint: "Mostly the top 500 most popular anime, with a 10% sprinkle of anything.",
    catalogHint: "Top 500 anime with songs 30-50% of players get right, or anime ranked 500-1000 with songs half get right.",
  },
  {
    value: "medium",
    label: "Medium",
    hint: "Mostly the top 1000 most popular anime, with a 10% sprinkle of anything.",
    catalogHint: "Top 500 anime with songs under 30% get right, anime ranked 500-1000 with songs 30-50% get right, or less popular anime with songs half get right.",
  },
  {
    value: "hard",
    label: "Hard",
    hint: "Every anime in the pool, leaning on ones outside the top 500.",
    catalogHint: "Anime ranked 500-1000 with songs under 30% get right, or less popular anime with songs under half get right.",
  },
  { value: "random", label: "Random", hint: "Any anime in the pool, no weighting.", catalogHint: "Any song, including ones with no difficulty rating." },
];

const difficulty = ref<PartyEndlessDifficulty>(props.state.endless?.difficulty ?? "easy");
const downloadedOnly = ref(props.state.endless?.downloadedOnly ?? false);
const { offlineMode } = useNetworkMode();
const outsideLibrary = ref(props.state.endless?.outsideLibrary ?? false);
const outsideBlocked = computed(() => offlineMode.value === true);
const running = computed(() => props.state.endless !== null);
const levels = computed(() => LEVELS.filter((level) => outsideLibrary.value || !level.catalogOnly));
const hint = computed(() => {
  const level = LEVELS.find((entry) => entry.value === difficulty.value);
  return (outsideLibrary.value ? level?.catalogHint : level?.hint) ?? "";
});

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

type Settings = Omit<PartyEndless, "scope" | "filtered">;
const catalogNote = computed(() => (props.state.endless?.outsideLibrary ? (props.state.endless.catalogNote ?? null) : null));
const notApplied = computed(() => catalogNote.value?.notApplied ?? []);
const settings = computed<Settings>(() => ({ difficulty: difficulty.value, downloadedOnly: downloadedOnly.value, outsideLibrary: outsideLibrary.value }));
const needsDeck = computed(() => !outsideLibrary.value && props.source.scope === null);

function send(config: Settings | null) {
  if (config === null) {
    emit("command", { type: "endless", config: null });
    return;
  }
  emit("command", {
    type: "endless",
    config: { ...config, scope: props.source.scope ?? { type: "all" }, filtered: Boolean(props.source.filters) },
    ...(props.source.filters ? { filters: props.source.filters } : {}),
  });
}

// While running, a change replaces the songs still to come. Source and filter
// changes are re-sent by the dashboard, so they apply with this panel closed.
function resend() {
  if (running.value && !needsDeck.value) send(settings.value);
}

function pick(value: PartyEndlessDifficulty) {
  difficulty.value = value;
  resend();
}

function setDownloaded(value: boolean) {
  downloadedOnly.value = value;
  resend();
}

function setOutside(value: boolean) {
  outsideLibrary.value = value;
  // Library songs store no guess rate, so Very easy has nothing to go on there.
  if (!value && difficulty.value === "veryEasy") difficulty.value = "easy";
  resend();
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
      It draws from the source and filters set above in New game.
    </p>
    <template v-if="state.endless?.filtered || source.filters">
      <p class="endless-hint">
        {{
          outsideLibrary
            ? "Filters are on: OP/ED, format, year and season, genres and tags narrow the catalog."
            : "Filters are on: only songs from matching anime are used."
        }}
      </p>
      <p v-if="outsideLibrary && notApplied.length" class="endless-hint">
        Not applied to songs outside your library: {{ notApplied.join(", ") }}.
      </p>
      <p v-else-if="outsideLibrary && !catalogNote" class="endless-hint">
        AniList score, studio, anime list, tag relevance and OP/ED mix can't be applied to songs outside your library.
      </p>
    </template>
    <p v-if="catalogNote?.unknownLabels.length" class="endless-hint">
      AnisongDB doesn't know {{ catalogNote.unknownLabels.join(", ") }}, so {{ catalogNote.unknownLabels.length === 1 ? "it was" : "they were" }} left out.
    </p>
    <p v-if="catalogNote?.noMatch" class="endless-hint endless-warn" role="status">
      No songs in AnisongDB match these filters. Loosen them in New game to keep the playlist going.
    </p>

    <label class="endless-check">
      <input type="checkbox" :checked="outsideLibrary" :disabled="outsideBlocked && !outsideLibrary" @change="setOutside(($event.target as HTMLInputElement).checked)" />
      Songs outside my cards and decks
    </label>
    <p v-if="outsideBlocked" class="endless-hint">Songs outside your library need online mode.</p>
    <p class="endless-hint">
      {{ outsideLibrary ? "Random songs from the whole AnisongDB catalog, picked by anime popularity and AMQ's guess rate, 5 at a time." : "Only songs you have cards for." }}
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

    <div class="levels" role="radiogroup" aria-label="Difficulty">
      <button
        v-for="level in levels"
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
    <p class="endless-hint">{{ hint }}</p>
    <p v-if="catalogNote?.rankingUnavailable && difficulty !== 'random'" class="endless-hint" role="status">
      Popularity ranking unavailable, using guess rate only.
    </p>

    <label v-if="!outsideLibrary" class="endless-check">
      <input type="checkbox" :checked="downloadedOnly" @change="setDownloaded(($event.target as HTMLInputElement).checked)" />
      Only songs I've downloaded
    </label>
    <p v-if="!outsideLibrary" class="endless-hint">
      {{ downloadedOnly ? "Songs without a local file are skipped." : "Songs that aren't downloaded stream from the clip source." }}
    </p>

    <div class="actions">
      <button v-if="!running" type="button" class="start-btn" @click="send(settings)" :disabled="needsDeck">
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

.endless-warn {
  color: var(--fail);
  font-weight: 700;
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

.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
