<script setup lang="ts">
import type { StudyScope } from "~/composables/useStudySession";

const route = useRoute();

type ScopeResult = { valid: true; scope: StudyScope } | { valid: false };

const scopeResult = computed<ScopeResult>(() => {
  const type = route.query.type;

  if (type === undefined || type === "all") {
    return { valid: true, scope: { type: "all" } };
  }

  if (type === "artist" || type === "anime") {
    const idRaw = route.query.id;
    const id = Number(idRaw);
    if (typeof idRaw === "string" && idRaw.trim() !== "" && Number.isFinite(id)) {
      return { valid: true, scope: { type, id } };
    }
  }

  return { valid: false };
});

const scope = computed<StudyScope | null>(() => (scopeResult.value.valid ? scopeResult.value.scope : null));

const { currentCard, loading, error, sessionComplete, reviewing, reviewedCount, presentationKey, submit } =
  useStudySession(scope);

const deckLabel = ref<string | null>(null);

async function fetchDeckLabel() {
  const result = scopeResult.value;
  if (!result.valid || result.scope.type === "all") {
    deckLabel.value = null;
    return;
  }
  try {
    const response = await $fetch<{ deckLabel: string }>("/api/decks/cards", {
      query: { type: result.scope.type, id: result.scope.id },
    });
    deckLabel.value = response.deckLabel;
  } catch {
    deckLabel.value = null;
  }
}

watch(scopeResult, fetchDeckLabel, { immediate: true });

const scopeChipLabel = computed(() => {
  const result = scopeResult.value;
  if (!result.valid) return "";
  return result.scope.type === "all" ? "All decks" : (deckLabel.value ?? "...");
});

const hideVideo = ref(false);
const hideInfo = ref(false);
const randomStart = ref(false);
const ambientMode = ref(false);

const AMBIENT_STORAGE_KEY = "gaqSrs:studyAmbientMode";

onMounted(() => {
  try {
    const stored = localStorage.getItem(AMBIENT_STORAGE_KEY);
    ambientMode.value = stored !== null ? stored === "1" : window.innerWidth > 820;
  } catch {
    ambientMode.value = window.innerWidth > 820;
  }
});

const { setAmbientGlass } = useAmbientGlass();
watch(ambientMode, (value) => {
  setAmbientGlass(value);
  try {
    localStorage.setItem(AMBIENT_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // localStorage unavailable (private browsing, locked-down environment) -
    // the toggle still works for this session, it just won't persist.
  }
});
onUnmounted(() => setAmbientGlass(false));

function onKeydown(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  if (key === "i") {
    hideInfo.value = !hideInfo.value;
  } else if (key === "v") {
    hideVideo.value = !hideVideo.value;
  } else if (key === "a") {
    ambientMode.value = !ambientMode.value;
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main class="study">
    <h1>Study</h1>

    <div v-if="!scopeResult.valid" class="state state-error">
      This study link isn't valid. Go back to <NuxtLink to="/decks">Decks</NuxtLink> and pick a deck.
    </div>
    <div v-else-if="loading && !currentCard" class="state">Loading...</div>
    <div v-else-if="error" class="state state-error">{{ error }}</div>
    <div v-else-if="sessionComplete" class="state">All caught up! Nothing due right now.</div>
    <template v-else-if="currentCard">
      <div class="scope-row">
        <span class="chip">{{ scopeChipLabel }}</span>
        <span class="count">Card {{ reviewedCount + 1 }} this session</span>
      </div>
      <StudyDisplayToggles
        :hide-video="hideVideo"
        :hide-info="hideInfo"
        :random-start="randomStart"
        :ambient-mode="ambientMode"
        @toggle-hide-video="hideVideo = !hideVideo"
        @toggle-hide-info="hideInfo = !hideInfo"
        @toggle-random-start="randomStart = !randomStart"
        @toggle-ambient-mode="ambientMode = !ambientMode"
      />
      <div class="study-grid">
        <StudyMediaPlayer
          :key="presentationKey"
          :card="currentCard"
          :hide-video="hideVideo"
          :random-start="randomStart"
          :ambient="ambientMode"
          :allow-expand="true"
        />
        <div class="side">
          <StudyInfoPanel
            :blurred="hideInfo"
            :ambient="ambientMode"
            :song-title="currentCard.songTitle"
            :artist-name="currentCard.artistName"
            :anime-title-english="currentCard.animeTitleEnglish"
            :anime-title-romaji="currentCard.animeTitleRomaji"
            :anime-title-native="currentCard.animeTitleNative"
          />
          <StudyAnswerControls :disabled="reviewing" @pass="submit('pass')" @fail="submit('fail')" />
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.study {
  max-width: 1200px;
  margin: 0 auto;
  padding: 48px 24px;
}

h1 {
  margin: 0 0 24px;
  font-size: 28px;
  font-weight: 800;
}

.state {
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.state a {
  color: var(--accent);
}

.state-error {
  color: var(--fail);
  border-color: var(--fail);
}

.scope-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent) 22%, var(--surface));
  border: 1px solid var(--accent);
  color: var(--accent);
  font-size: 14px;
  font-weight: 700;
}

.count {
  color: var(--muted);
  font-size: 14px;
}

.study-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 32px;
  align-items: start;
}

@media (max-width: 820px) {
  .study-grid {
    grid-template-columns: 1fr;
  }
}

.side {
  display: flex;
  flex-direction: column;
  gap: 26px;
}
</style>
