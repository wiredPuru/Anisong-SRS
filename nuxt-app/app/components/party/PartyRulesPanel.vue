<script setup lang="ts">
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const MAX = 2000;
const open = ref(false);
const draft = ref(props.state.rules);
const editing = ref(false);

// The server's copy wins unless the host is typing.
watch(() => props.state.rules, (text) => {
  if (!editing.value) draft.value = text;
});

const dirty = computed(() => draft.value !== props.state.rules);

function save() {
  if (dirty.value) emit("command", { type: "rules", text: draft.value });
}
</script>

<template>
  <section class="rules" aria-labelledby="rules-title">
    <div class="rules-head">
      <button type="button" class="rules-toggle" :aria-expanded="open" @click="open = !open">
        <span class="rules-chevron" :class="{ open }" aria-hidden="true">&#9656;</span>
        <span id="rules-title">Rules</span>
      </button>
    </div>
    <template v-if="open">
      <textarea
        v-model="draft"
        class="rules-text"
        rows="6"
        :maxlength="MAX"
        placeholder="One rule per line, for example: Buzz in before you answer. Wrong answers lock you out for the song."
        aria-label="Game rules"
        @focus="editing = true"
        @blur="editing = false; save()"
        @keydown.stop
      />
      <div class="rules-foot">
        <span class="rules-count">{{ draft.length }} / {{ MAX }}. Place, resize or hide them from the display's Arrange layout.</span>
        <button type="button" class="rules-save" :disabled="!dirty" @click="save">Save</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.rules-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rules-toggle {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--text);
  font-family: var(--font-display);
  font-size: 16px;
  text-align: left;
  cursor: pointer;
}

.rules-chevron {
  display: inline-block;
  transition: transform 0.15s;
}

.rules-chevron.open {
  transform: rotate(90deg);
}

.rules-chip {
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 12px;
  font-weight: 700;
}

.rules-show,
.rules-save {
  padding: 6px 14px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.rules-show.active {
  background: var(--accent);
  color: var(--accent-ink);
}

.rules-show:disabled,
.rules-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rules-text {
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.rules-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rules-count {
  color: var(--muted);
  font-size: 12px;
}
</style>
