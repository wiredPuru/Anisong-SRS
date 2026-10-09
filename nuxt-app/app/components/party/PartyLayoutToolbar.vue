<script setup lang="ts">
import { CHOICE_STYLES, PIECE_CATEGORIES, PIECE_LABELS } from "~/utils/partyLayout";

const emit = defineEmits<{ done: [] }>();

const { reset, category, selected, settings, isHidden, setHidden, setChoiceStyle } = usePartyLayout();

function pickCategory(id: (typeof PIECE_CATEGORIES)[number]["id"]) {
  category.value = id;
  selected.value = null;
}
const active = computed(() => PIECE_CATEGORIES.find((entry) => entry.id === category.value) ?? PIECE_CATEGORIES[0]);
</script>

<template>
  <div class="layout-toolbar" role="toolbar" aria-label="Arrange the screen">
    <div class="layout-tabs" role="tablist" aria-label="What to arrange">
      <button
        v-for="entry in PIECE_CATEGORIES"
        :key="entry.id"
        type="button"
        role="tab"
        class="layout-tab"
        :class="{ active: entry.id === category }"
        :aria-selected="entry.id === category"
        @click="pickCategory(entry.id)"
      >
        {{ entry.label }}
      </button>
    </div>

    <div class="layout-shown" role="group" aria-label="Pieces shown on screen">
      <span v-for="piece in active.pieces" :key="piece" class="layout-check" :class="{ picked: selected === piece }">
        <input
          type="checkbox"
          :checked="!isHidden(piece)"
          :aria-label="`Show ${PIECE_LABELS[piece]}`"
          @change="setHidden(piece, !($event.target as HTMLInputElement).checked)"
        />
        <button type="button" class="layout-name" :aria-pressed="selected === piece" title="Edit just this piece" @click="selected = selected === piece ? null : piece">
          {{ PIECE_LABELS[piece] }}
        </button>
      </span>
    </div>

    <div v-if="category === 'choices'" class="layout-styles" role="radiogroup" aria-label="How the options are arranged">
      <button
        v-for="style in CHOICE_STYLES"
        :key="style.id"
        type="button"
        role="radio"
        class="layout-tab"
        :class="{ active: settings.choiceStyle === style.id }"
        :aria-checked="settings.choiceStyle === style.id"
        @click="setChoiceStyle(style.id)"
      >
        {{ style.label }}
      </button>
    </div>

    <p class="layout-toolbar-hint">
      Click a piece or its name to edit just that one (click empty space to go back). Drag to move, corner dot to resize, untick to hide.
    </p>
    <div class="layout-actions">
      <button type="button" class="layout-toolbar-button" @click="reset">Reset layout</button>
      <button type="button" class="layout-toolbar-button primary" @click="selected = null; emit('done')">Done</button>
    </div>
  </div>
</template>

<style scoped>
.layout-toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-chrome);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 14px;
  width: max-content;
  max-width: calc(100vw - 24px);
  padding: 10px 14px;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.layout-tabs,
.layout-shown,
.layout-styles,
.layout-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.layout-tab {
  padding: 4px 14px;
  border: 2px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.layout-tab.active {
  border-color: var(--accent);
  color: var(--accent);
}

.layout-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
}

.layout-name {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.layout-check.picked .layout-name {
  color: var(--accent);
  text-decoration: underline;
}

.layout-toolbar-hint {
  margin: 0;
  flex-basis: 100%;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

.layout-toolbar-button {
  flex-shrink: 0;
  padding: 6px 16px;
  border: 2px solid var(--outline);
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.layout-toolbar-button.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
}
</style>
