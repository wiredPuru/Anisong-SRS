<script setup lang="ts">
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ jump: [index: number]; command: [command: PartyHostCommand] }>();

// Only songs still to come can move or go; the current one moves on with Next.
const isUpcoming = (index: number) => index > props.state.index;

const list = ref<HTMLOListElement | null>(null);

// Keeps the current song in view as the game moves through a long queue.
watch(
  () => props.state.index,
  async () => {
    await nextTick();
    // Scrolls the list only; scrollIntoView would also move the page.
    const listEl = list.value;
    const row = listEl?.querySelector<HTMLElement>(".is-current");
    if (!listEl || !row) return;
    if (row.offsetTop < listEl.scrollTop) listEl.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > listEl.scrollTop + listEl.clientHeight) {
      listEl.scrollTop = row.offsetTop + row.offsetHeight - listEl.clientHeight;
    }
  },
);
</script>

<template>
  <section class="queue" aria-labelledby="queue-title">
    <h2 id="queue-title" class="queue-title">Queue</h2>
    <ol ref="list" class="queue-list">
      <li v-for="(item, index) in state.queue" :key="`${index}-${item.cardId}`" class="queue-row">
        <button
          type="button"
          class="queue-item"
          :class="{ 'is-current': index === state.index, 'is-done': index < state.index }"
          :aria-current="index === state.index ? 'true' : undefined"
          @click="emit('jump', index)"
        >
          <span class="queue-num">{{ index + 1 }}</span>
          <span class="queue-text">
            <span class="queue-anime">{{ item.answer.animeTitleEnglish }}</span>
            <span class="queue-song">{{ item.answer.songTitle }} · {{ formatThemeSlotLabel(item.answer.themeSlot) }}</span>
          </span>
        </button>
        <span v-if="isUpcoming(index)" class="queue-edit">
          <button
            type="button"
            class="qbtn"
            :disabled="index <= state.index + 1"
            :aria-label="`Move ${item.answer.animeTitleEnglish} up`"
            @click="emit('command', { type: 'queueMove', from: index, to: index - 1 })"
          >
            &#8593;
          </button>
          <button
            type="button"
            class="qbtn"
            :disabled="index >= state.queue.length - 1"
            :aria-label="`Move ${item.answer.animeTitleEnglish} down`"
            @click="emit('command', { type: 'queueMove', from: index, to: index + 1 })"
          >
            &#8595;
          </button>
          <button
            type="button"
            class="qbtn qbtn-remove"
            :aria-label="`Remove ${item.answer.animeTitleEnglish} from the queue`"
            @click="emit('command', { type: 'queueRemove', index })"
          >
            &#10005;
          </button>
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.queue {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.queue-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.queue-list {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.queue-row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--border);
}

.queue-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
}

.qbtn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
}

.qbtn:disabled {
  opacity: 0.35;
  cursor: default;
}

.qbtn-remove {
  color: var(--fail);
}

.queue-item {
  flex: 1;
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  text-align: left;
  cursor: pointer;
}

.queue-item.is-done {
  color: var(--faint);
}

.queue-item.is-current {
  background: var(--surface-raised);
  box-shadow: inset 4px 0 0 var(--accent);
}

.queue-num {
  min-width: 2ch;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.queue-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.queue-anime {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-song {
  font-size: 13px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
