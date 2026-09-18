<script setup lang="ts">
import type { TypedAnswerCategories } from "~/utils/typedAnswerCategories";

defineProps<{
  categories: TypedAnswerCategories;
}>();
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
        <p class="hint">Choose what you guess each round. Correct extra categories add bonus points - only the anime name affects scheduling.</p>
        <div class="category-row locked">
          <span class="category-label">Anime name</span>
          <span class="locked-badge">Always on</span>
        </div>
        <div class="category-row">
          <span class="category-label">Opening/Ending number</span>
          <button
            type="button"
            class="category-toggle"
            :class="{ on: categories.themeSlot }"
            :aria-pressed="categories.themeSlot"
            @click="emit('update:categories', { ...categories, themeSlot: !categories.themeSlot })"
          >
            {{ categories.themeSlot ? "On" : "Off" }}
          </button>
        </div>
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

.category-toggle.on {
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
  box-shadow: 0 0 14px var(--accent-secondary-glow);
}
</style>
