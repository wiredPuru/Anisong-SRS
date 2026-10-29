<script setup lang="ts">
import { formatKunReading, formatRtkFrame, formatStrokes, MAX_KANJI_STORY_LENGTH, storyDraftState } from "~/utils/japaneseBreakdown";
import { kanjiKeyAction, pickSourceClip, storyView } from "~/utils/kanjiStudy";

const { data: settings, pending: settingsPending } = await useFetch<{
  japaneseBreakdown: boolean;
  defaultDownloadFolder: string | null;
  playbackMode: "auto" | "audioOnly";
  autoDownload: boolean;
  clipSource: "anisongdb" | "both" | "animethemes";
}>("/api/media-library");
const enabled = computed(() => settings.value?.japaneseBreakdown ?? false);
const clipSource = computed(() => settings.value?.clipSource ?? "anisongdb");
const background = useBackgroundClips(clipSource);

const study = useKanjiStudy();
const { current, dueCount, loading, error, revealed, story, defaultStory, storySaving, storyError, grading, passed, failed } = study;
const shownStory = computed(() => storyView(story.value, defaultStory.value));

const editing = ref(false);
const draft = ref("");
const draftState = computed(() => storyDraftState(story.value, draft.value));

function startEdit() {
  draft.value = shownStory.value.kind === "none" ? "" : shownStory.value.text;
  editing.value = true;
}

async function saveDraft() {
  if (!draftState.value.canSave) return;
  if (await study.saveStory(draft.value.trim())) editing.value = false;
}

async function useDefaultStory() {
  if (shownStory.value.kind === "default") await study.saveStory(shownStory.value.text);
}

async function removeOwnStory() {
  await study.removeStory();
}

watch(() => current.value?.char, () => {
  editing.value = false;
});

// Skipping or an error leaves the kanji's own song until the next kanji loads.
const sourceDropped = ref(false);
const sourceReplays = ref(0);
const sourceClip = computed(() => (sourceDropped.value ? null : pickSourceClip(study.sourceCard.value, clipSource.value)));
const backgroundClip = computed(() => sourceClip.value ?? background.current.value);
const playerKey = computed(() =>
  sourceClip.value ? `source-${sourceReplays.value}` : `random-${background.presentationKey.value}`,
);

watch(loading, (isLoading) => {
  if (!isLoading) return;
  sourceDropped.value = false;
  sourceReplays.value += 1;
});

function onClipEnded() {
  if (sourceClip.value) sourceReplays.value += 1;
  else background.next();
}

function skipClip() {
  if (sourceClip.value) sourceDropped.value = true;
  else background.next();
}
const parts = computed(() => current.value?.partInfo.filter((part) => part.char !== current.value?.char) ?? []);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
}

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event.target)) return;
  const action = kanjiKeyAction(event.key, revealed.value, { ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey });
  if (!action) return;
  event.preventDefault();
  if (action === "reveal") study.reveal();
  else study.grade(action);
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  if (enabled.value) {
    study.loadNext();
    background.load();
  }
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <main class="kanji-page">
    <header class="kanji-header">
      <h1>Kanji Study</h1>
      <p v-if="enabled" class="kanji-tally" aria-live="polite">
        <span>{{ dueCount }} left</span>
        <span class="tally-pass">{{ passed }} passed</span>
        <span class="tally-fail">{{ failed }} missed</span>
      </p>
    </header>

    <MascotState v-if="settingsPending" pose="laptop"><ActivityStatus label="Loading Kanji Study" /></MascotState>

    <MascotState v-else-if="!enabled" pose="point">
      Kanji Study is part of the Japanese breakdown.
      <NuxtLink to="/settings?section=playback">Turn it on in Settings</NuxtLink>.
    </MascotState>

    <template v-else>
      <MascotState v-if="loading && !current" pose="laptop"><ActivityStatus label="Loading your kanji" /></MascotState>

      <MascotState v-else-if="error && !current" pose="slump">
        <span role="alert">{{ error }}</span>
        <button type="button" class="kanji-link" @click="study.loadNext()">Try again</button>
      </MascotState>

      <MascotState v-else-if="!current" pose="sleepy">
        You're all caught up. Add more kanji from the Japanese breakdown on Study or Listen (press J, then
        Add to Kanji Study).
      </MascotState>

      <div class="kanji-stage">
      <section v-if="current" class="kanji-card" aria-label="Kanji flashcard">
        <p class="kanji-char" lang="ja">{{ current.char }}</p>

        <template v-if="revealed">
          <p class="kanji-keyword">
            {{ current.entry.keyword || "(no English meaning)" }}
            <span v-if="current.entry.alternates.length" class="kanji-alt">{{ current.entry.alternates.join(", ") }}</span>
          </p>
          <p v-if="current.entry.on.length || current.entry.kun.length" class="kanji-readings" lang="ja">
            <span v-if="current.entry.on.length">{{ current.entry.on.join("、") }}</span>
            <span v-if="current.entry.kun.length">{{ current.entry.kun.map(formatKunReading).join("、") }}</span>
          </p>
          <p class="kanji-meta">
            {{ formatStrokes(current.entry.strokes) }}
            <template v-if="formatRtkFrame(current.entry.rtk)"> &middot; {{ formatRtkFrame(current.entry.rtk) }}</template>
            &middot; Box {{ current.box }}
          </p>
          <p v-if="parts.length" class="kanji-parts" lang="ja" aria-label="Components">
            <span v-for="part in parts" :key="part.char" class="kanji-part">
              <span class="kanji-part-char">{{ part.char }}</span>
              <span class="kanji-part-keyword" lang="en">{{ part.keyword ?? "(shape)" }}</span>
            </span>
          </p>
          <div v-if="shownStory.kind !== 'none' && !editing" class="kanji-story">
            <p class="kanji-story-text">{{ shownStory.text }}</p>
            <p v-if="shownStory.kind === 'default'" class="kanji-story-credit">
              <a :href="shownStory.url" target="_blank" rel="noopener">Koohii story by {{ shownStory.author }}</a>
            </p>
          </div>

          <div v-if="editing" class="kanji-editor">
            <label class="kanji-editor-label" for="kanji-story-input">Your story</label>
            <textarea
              id="kanji-story-input"
              v-model="draft"
              class="kanji-editor-input"
              rows="4"
              :maxlength="MAX_KANJI_STORY_LENGTH + 200"
              :disabled="storySaving"
              placeholder="Make up a vivid story using the keyword and the parts"
            />
            <p class="kanji-editor-count" :class="{ 'kanji-editor-over': draftState.tooLong }">
              {{ draft.trim().length }} / {{ MAX_KANJI_STORY_LENGTH }}
            </p>
            <div class="kanji-story-actions">
              <button type="button" class="kanji-small kanji-small-primary" :disabled="!draftState.canSave || storySaving" @click="saveDraft">
                {{ storySaving ? "Saving..." : "Save story" }}
              </button>
              <button type="button" class="kanji-small" :disabled="storySaving" @click="editing = false">Cancel</button>
            </div>
          </div>
          <div v-else class="kanji-story-actions">
            <button type="button" class="kanji-small" @click="startEdit">
              {{ shownStory.kind === "none" ? "Add story" : "Edit story" }}
            </button>
            <button v-if="shownStory.kind === 'default'" type="button" class="kanji-small" :disabled="storySaving" @click="useDefaultStory">
              Use this story
            </button>
            <button v-if="shownStory.kind === 'personal'" type="button" class="kanji-small" :disabled="storySaving" @click="removeOwnStory">
              Remove
            </button>
          </div>
          <p v-if="storyError" class="kanji-error" role="alert">{{ storyError }}</p>
        </template>

        <p v-if="error" class="kanji-error" role="alert">{{ error }}</p>

        <div class="kanji-actions">
          <button v-if="!revealed" type="button" class="kanji-reveal" @click="study.reveal()">Reveal</button>
          <template v-else>
            <button type="button" class="kanji-fail" :disabled="grading" @click="study.grade('fail')">Missed</button>
            <button type="button" class="kanji-pass" :disabled="grading" @click="study.grade('pass')">Got it</button>
          </template>
        </div>
        <p class="kanji-hint">
          <template v-if="!revealed">Recall the meaning, then press Space or Reveal.</template>
          <template v-else>Left Arrow if you missed it, Right Arrow if you got it.</template>
        </p>
      </section>

      <aside v-if="backgroundClip" class="kanji-clip" aria-label="Background clip">
        <StudyMediaPlayer
          :key="playerKey"
          :card="backgroundClip"
          hide-theme-badge
          autoplay
          :audio-only="settings?.playbackMode === 'audioOnly'"
          :auto-download="settings?.autoDownload ?? false"
          :has-default-download-folder="Boolean(settings?.defaultDownloadFolder)"
          :clip-source="clipSource"
          @playback-ended="onClipEnded"
        >
          <template #error-actions>
            <button type="button" class="kanji-link" @click="skipClip">Next clip</button>
          </template>
        </StudyMediaPlayer>
        <button type="button" class="kanji-skip" @click="skipClip">Skip clip</button>
      </aside>
      </div>
    </template>
  </main>
</template>

<style scoped>
.kanji-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
}

.kanji-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.kanji-header h1 {
  margin: 0;
  font-family: var(--font-display);
}

.kanji-tally {
  display: flex;
  gap: 14px;
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
}

.tally-pass {
  color: var(--pass);
}

.tally-fail {
  color: var(--fail);
}

.kanji-stage {
  display: grid;
  grid-template-columns: minmax(0, 560px) minmax(0, 1fr);
  align-items: start;
  justify-content: center;
  gap: 24px;
}

.kanji-clip {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.kanji-skip {
  align-self: flex-start;
  padding: 5px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--muted);
  font: 600 13px var(--font-sans);
  cursor: pointer;
}

@media (max-width: 1100px) {
  .kanji-stage {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Side by side the whole page fits the window; a long reveal scrolls inside the card. */
@media (min-width: 1101px) {
  .kanji-page {
    flex: 1;
    min-height: 0;
    padding-block: 16px;
    gap: 12px;
    overflow: hidden;
  }

  .kanji-stage {
    flex: 1;
    min-height: 0;
    grid-template-columns: minmax(0, 520px) minmax(0, 400px);
    grid-template-rows: minmax(0, 1fr);
  }

  .kanji-card {
    max-height: 100%;
    overflow-y: auto;
  }

  .kanji-clip {
    max-height: 100%;
  }

  .kanji-char {
    font-size: clamp(72px, 16vh, 140px);
  }
}

.kanji-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 24px;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  text-align: center;
}

.kanji-card > p {
  margin: 0;
}

.kanji-char {
  font-size: 140px;
  line-height: 1.1;
}

.kanji-keyword {
  font-size: 26px;
  font-weight: 700;
  text-transform: capitalize;
}

.kanji-alt {
  display: block;
  color: var(--muted);
  font-size: 15px;
  font-weight: 600;
  text-transform: none;
}

.kanji-readings {
  display: flex;
  flex-direction: column;
  color: var(--muted);
  font-size: 16px;
}

.kanji-meta {
  color: var(--faint);
  font-size: 13px;
}

.kanji-parts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.kanji-part {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.kanji-part-char {
  font-size: 22px;
}

.kanji-part-keyword {
  color: var(--muted);
  font-size: 12px;
}

.kanji-story {
  max-width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
}

.kanji-card > .kanji-story > p {
  margin: 0;
}

.kanji-story-text {
  white-space: pre-wrap;
}

.kanji-card > .kanji-story > .kanji-story-credit {
  margin-top: 6px;
  color: var(--faint);
  font-size: 12px;
}

.kanji-story-credit a {
  color: inherit;
}

.kanji-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  text-align: left;
}

.kanji-editor-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.kanji-editor-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text);
  font: 14px/1.5 var(--font-sans);
  resize: vertical;
}

.kanji-editor-count {
  margin: 0;
  align-self: flex-end;
  color: var(--faint);
  font-size: 12px;
}

.kanji-editor-over {
  color: var(--fail);
}

.kanji-story-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.kanji-small {
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--muted);
  font: 600 12px var(--font-sans);
  cursor: pointer;
}

.kanji-small-primary {
  border-color: var(--accent);
  color: var(--accent);
}

.kanji-small:disabled {
  opacity: 0.5;
  cursor: default;
}

.kanji-error {
  color: var(--fail);
  font-size: 14px;
}

.kanji-actions {
  display: flex;
  gap: 12px;
  margin-top: 6px;
}

.kanji-reveal,
.kanji-pass,
.kanji-fail {
  padding: 10px 28px;
  border: 0;
  border-radius: var(--radius-pill);
  font: 700 16px var(--font-sans);
  cursor: pointer;
}

.kanji-reveal {
  background: var(--accent);
  color: var(--accent-ink);
}

.kanji-pass {
  background: var(--pass);
  color: var(--accent-ink);
}

.kanji-fail {
  background: var(--fail);
  color: var(--accent-ink);
}

.kanji-pass:disabled,
.kanji-fail:disabled {
  opacity: 0.6;
  cursor: default;
}

.kanji-hint {
  color: var(--faint);
  font-size: 13px;
}

.kanji-link {
  margin-left: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}
</style>
