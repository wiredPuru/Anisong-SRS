<script setup lang="ts">
interface SessionHistoryCard {
  id: number;
  songTitle: string;
  artistName: string;
  animeTitleEnglish: string;
}

interface SessionHistoryEntry {
  card: SessionHistoryCard;
  result: "pass" | "fail";
}

const props = defineProps<{
  entries: SessionHistoryEntry[];
  open: boolean;
}>();
const emit = defineEmits<{ close: []; select: [entry: SessionHistoryEntry] }>();

const reversedEntries = computed(() =>
  props.entries.map((entry, index) => ({ entry, index })).reverse(),
);

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event)) return;
  if (event.key === "Escape") emit("close");
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('close')">
    <div class="panel">
      <button type="button" class="close-btn" aria-label="Close" @click="emit('close')">✕</button>
      <h2 class="title">
        Session log<template v-if="entries.length"> &middot; {{ entries.length }} card{{
          entries.length === 1 ? "" : "s"
        }}</template>
      </h2>
      <p v-if="entries.length === 0" class="empty-hint">No cards reviewed yet this session.</p>
      <ul v-else class="log-list">
        <li v-for="{ entry, index } in reversedEntries" :key="index">
          <button type="button" class="log-row" @click="emit('select', entry)">
            <span class="result-chip" :class="entry.result">{{ entry.result === "pass" ? "Pass" : "Fail" }}</span>
            <span class="log-info">
              <span class="log-song">{{ entry.card.songTitle }}</span>
              <span class="log-meta">{{ entry.card.artistName }} &middot; {{ entry.card.animeTitleEnglish }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 6, 15, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: var(--z-above-immersive);
}

.panel {
  position: relative;
  width: 100%;
  max-width: 420px;
  max-height: min(600px, 80vh);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px;
  border-radius: var(--radius);
  background: var(--bg);
  border: 1px solid var(--border);
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

.empty-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.log-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.log-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  text-align: left;
  cursor: pointer;
}

.log-row:hover,
.log-row:focus-visible {
  border-color: var(--accent-secondary);
}

.result-chip {
  flex: none;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.result-chip.pass {
  color: var(--pass);
  border: 1px solid var(--pass);
  background: color-mix(in srgb, var(--pass) 12%, var(--bg));
}

.result-chip.fail {
  color: var(--fail);
  border: 1px solid var(--fail);
  background: color-mix(in srgb, var(--fail) 12%, var(--bg));
}

.log-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.log-song {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-meta {
  color: var(--muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
