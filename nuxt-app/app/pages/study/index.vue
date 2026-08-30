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
const showControls = ref(true);
const immersive = ref(false);
const { height: navHeight } = useNavHeight();

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

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event)) return;
  const key = event.key.toLowerCase();
  if (key === "i") {
    hideInfo.value = !hideInfo.value;
  } else if (key === "v") {
    hideVideo.value = !hideVideo.value;
  } else if (key === "a") {
    ambientMode.value = !ambientMode.value;
  } else if (key === "h") {
    showControls.value = !showControls.value;
  } else if (key === "e") {
    immersive.value = !immersive.value;
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main class="study" :style="{ '--nav-height': `${navHeight}px` }">
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
        <button
          type="button"
          class="controls-toggle-btn"
          :aria-label="showControls ? 'Hide controls' : 'Show controls'"
          @click="showControls = !showControls"
        >
          <span aria-hidden="true">{{ showControls ? "👁" : "🙈" }}</span>
          <span class="tooltip">{{ showControls ? "Hide controls" : "Show controls" }} &middot; Hotkey: H</span>
        </button>
      </div>
      <StudyDisplayToggles
        v-if="showControls"
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
          :hide-theme-badge="hideInfo"
          v-model:immersive="immersive"
        />
        <div class="side" :class="{ 'immersive-overlay': immersive }">
          <div class="info-slot">
            <StudyInfoPanel
              :blurred="hideInfo"
              :ambient="ambientMode"
              :hide-toggles="!showControls"
              :immersive="immersive"
              :song-title="currentCard.songTitle"
              :song-title-native="currentCard.songTitleNative"
              :artist-name="currentCard.artistName"
              :anime-title-english="currentCard.animeTitleEnglish"
              :anime-title-romaji="currentCard.animeTitleRomaji"
              :anime-title-native="currentCard.animeTitleNative"
            />
          </div>
          <div class="answer-slot">
            <StudyAnswerControls :disabled="reviewing" @pass="submit('pass')" @fail="submit('fail')" />
          </div>
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

.controls-toggle-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--faint);
  font-size: 14px;
  opacity: 0.6;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.controls-toggle-btn:hover,
.controls-toggle-btn:focus-visible {
  opacity: 1;
}

.controls-toggle-btn .tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 5;
}

.controls-toggle-btn:hover .tooltip,
.controls-toggle-btn:focus-visible .tooltip {
  opacity: 1;
  visibility: visible;
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

/* Matches StudyMediaPlayer.vue's .player-card.expanded .player-frame sizing
   formula exactly, so these slots track the video's real (centered,
   letterboxed) box instead of the full viewport. */
.side.immersive-overlay {
  --video-width: min(90vw, calc((100vh - var(--nav-height)) * 0.9 * 16 / 9));
}

.info-slot,
.answer-slot {
  pointer-events: none;
}

.side.immersive-overlay .info-slot,
.side.immersive-overlay .answer-slot {
  position: fixed;
  z-index: 65;
  pointer-events: auto;
}

/* Narrow: not enough room beside the video, so both slots anchor inside its
   own box - clearing the theme badge/expand button at the top and the
   playback-controls bar at the bottom. */
.side.immersive-overlay .info-slot {
  top: calc(var(--nav-height) + 76px);
  left: calc(50vw - (var(--video-width) / 2) + 16px);
  max-width: calc(var(--video-width) * 0.55);
}

.side.immersive-overlay .answer-slot {
  left: calc(50vw - (var(--video-width) / 2) + 16px);
  bottom: 74px;
  width: calc(var(--video-width) - 32px);
}

/* Wide: enough leftover space beside the video to flank it instead - info
   card back in its familiar left-hand spot, Pass/Fail moves to the right. */
@media (min-width: 1400px) {
  .side.immersive-overlay .info-slot {
    top: calc(var(--nav-height) + 24px);
    left: 24px;
    max-width: calc(50vw - (var(--video-width) / 2) - 40px);
  }

  .side.immersive-overlay .answer-slot {
    left: auto;
    right: 24px;
    bottom: auto;
    top: 50%;
    width: calc(50vw - (var(--video-width) / 2) - 40px);
    transform: translateY(-50%);
  }
}
</style>
