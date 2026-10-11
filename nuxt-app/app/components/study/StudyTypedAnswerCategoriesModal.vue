<script setup lang="ts">
import type { CategoryLock, RequiredCategories } from "~/utils/criterionGrading";
import type { TypedAnswerCategories } from "~/utils/typedAnswerCategories";

// A manual deck graded on something other than the anime title (feature 71)
// decides exactly which categories a round asks, so every row is locked here
// and no bonus can be toggled on. A deck graded on the title always asks the
// anime, so only that row is locked. Any other scope is the player's choice,
// even while Anime name being off has moved it onto another track. The stored
// preference underneath is never rewritten.
const props = withDefaults(
  defineProps<{
    categories: TypedAnswerCategories;
    required?: RequiredCategories;
    lock?: CategoryLock;
  }>(),
  { required: () => ({ anime: true, songName: false, themeSlot: false, artist: false }), lock: "none" },
);
const animeLocked = computed(() => props.lock === "anime");
const deckRows = computed(() => [
  { label: "Anime name", required: props.required.anime },
  { label: "Song name", required: props.required.songName },
  { label: "Opening/Ending number", required: props.required.themeSlot },
  { label: "Artist", required: props.required.artist },
]);
type ToggleKey = keyof TypedAnswerCategories;
const bonusOnly = computed(() => props.categories.songName || props.categories.themeSlot || props.categories.artist);
const toggleRows = computed(() => {
  const c = props.categories;
  const others = (key: ToggleKey) => (["anime", "songName", "artist"] as const).filter((k) => k !== key && c[k]).length;
  const lastOne = (key: ToggleKey) => c[key] && others(key) === 0;
  return [
    animeLocked.value
      ? { key: "anime" as const, label: "Anime name", locked: true, lockedReason: "A deck always asks the anime title" }
      : { key: "anime" as const, label: "Anime name", locked: lastOne("anime"), lockedReason: "Turn on the song or artist first" },
    { key: "songName" as const, label: "Song name", locked: lastOne("songName"), lockedReason: "At least one category must stay on" },
    { key: "themeSlot" as const, label: "Opening/Ending number", locked: !c.anime, lockedReason: "Needs Anime name" },
    { key: "artist" as const, label: "Artist", locked: lastOne("artist"), lockedReason: "At least one category must stay on" },
  ];
});

function isOn(key: ToggleKey): boolean {
  return key === "anime" && animeLocked.value ? true : props.categories[key];
}

function toggle(key: ToggleKey) {
  const next = { ...props.categories, [key]: !props.categories[key] };
  if (!next.anime) next.themeSlot = false;
  if (!hasAnswerCategory(next)) return;
  emit("update:categories", next);
}

const emit = defineEmits<{
  "update:categories": [TypedAnswerCategories];
  close: [];
}>();

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event)) return;
  if (event.key === "Escape") emit("close");
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="emit('close')">
      <div class="panel">
        <button type="button" class="close-btn" aria-label="Close" @click="emit('close')">✕</button>
        <h2 class="title">Answer categories</h2>
        <template v-if="lock !== 'deck'">
          <p class="hint">Choose what you guess each round, at least one. Turn Anime name off to grade on the song or artist instead, on their own schedule.</p>
          <div v-for="row in toggleRows" :key="row.key" class="category-row">
            <span class="category-label">{{ row.label }}</span>
            <button
              type="button"
              class="category-toggle"
              :class="{ on: isOn(row.key) }"
              :aria-pressed="isOn(row.key)"
              :disabled="row.locked"
              :title="row.lockedReason"
              @click="toggle(row.key)"
            >
              {{ isOn(row.key) ? "On" : "Off" }}
            </button>
          </div>
          <p v-if="!categories.anime && !animeLocked" class="hint">Opening/Ending number needs Anime name, so it is off while that is.</p>
          <p v-else-if="bonusOnly" class="hint">With Anime name on, extra categories add bonus points and only the anime name affects scheduling.</p>
        </template>
        <template v-else>
          <p class="hint">This deck decides what each round asks.</p>
          <div v-for="row in deckRows" :key="row.label" class="category-row locked">
            <span class="category-label">{{ row.label }}</span>
            <span class="locked-badge">{{ row.required ? "Required by this deck" : "Not asked by this deck" }}</span>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: var(--z-modal);
}

.panel {
  position: relative;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 28px;
  border-radius: calc(var(--radius) + 8px);
  background: var(--bg);
  border: 1px solid var(--outline);
  box-shadow: var(--shadow-soft);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
}

.title {
  margin: 0;
  padding-right: 36px;
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.category-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
}

.category-row.locked {
  opacity: 0.75;
}

.category-label {
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
}

.locked-badge {
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.category-toggle {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.category-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.category-toggle.on {
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
  box-shadow: 0 0 14px var(--accent-secondary-glow);
}
</style>
