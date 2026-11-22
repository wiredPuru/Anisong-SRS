<script setup lang="ts">
import type { PartyHostState } from "~/composables/usePartyHost";
import { moreOptionsSections, PIN_LIMIT } from "~/utils/partyHostPins";
import { commandStatus, type PaletteLocal, type PartyPaletteCommand } from "~/utils/partyPalette";

const props = defineProps<{ open: boolean; state: PartyHostState | null; local: PaletteLocal }>();
const emit = defineEmits<{ pick: [command: PartyPaletteCommand]; close: [] }>();

const { pins, toggle, full } = usePartyHostPins();
const editing = ref(false);
const sections = moreOptionsSections();

watch(
  () => props.open,
  (open) => {
    if (!open) editing.value = false;
  },
);

const pinned = computed(() => new Set(pins.value));

function status(command: PartyPaletteCommand) {
  return commandStatus(command, props.state, props.local);
}

function onClick(command: PartyPaletteCommand) {
  if (editing.value) {
    toggle(command.id);
    return;
  }
  if (status(command).reason) return;
  emit("pick", command);
}
</script>

<template>
  <PartyHostDialog :open="open" title="More options" wide @close="emit('close')">
    <template #actions>
      <button type="button" class="edit-btn" :class="{ on: editing }" :aria-pressed="editing" @click="editing = !editing">
        {{ editing ? "Done" : "Edit pins" }}
      </button>
    </template>

    <p v-if="editing" class="mo-note">
      Click to pin or unpin. Pinned controls show in the left column ({{ pins.length }} of {{ PIN_LIMIT }}).
      <template v-if="full"> The grid is full: unpin one to add another.</template>
    </p>

    <section v-for="section in sections" :key="section.id" class="mo-section">
      <h3 class="mo-title">{{ section.title }}</h3>
      <div class="mo-buttons">
        <button
          v-for="command in section.commands"
          :key="command.id"
          type="button"
          class="mo-btn"
          :class="{
            on: !editing && status(command).on,
            pinned: editing && pinned.has(command.id),
            panel: command.kind === 'jump',
          }"
          :disabled="!editing && Boolean(status(command).reason)"
          :title="editing ? (pinned.has(command.id) ? 'Unpin' : full ? 'The grid is full' : 'Pin to the left column') : (status(command).reason ?? '')"
          :aria-pressed="editing ? pinned.has(command.id) : (status(command).on ?? undefined)"
          @click="onClick(command)"
        >
          <span v-if="editing && pinned.has(command.id)" class="mo-pin" aria-hidden="true">●</span>
          {{ command.title }}
          <span v-if="!editing && status(command).on !== null" class="mo-state">{{ status(command).on ? "On" : "Off" }}</span>
          <kbd v-if="!editing && command.hotkey" class="mo-key">{{ command.hotkey }}</kbd>
        </button>
      </div>
    </section>
  </PartyHostDialog>
</template>

<style scoped>
.edit-btn {
  padding: 6px 14px;
  border: 2px solid var(--accent-secondary);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.edit-btn.on {
  background: var(--accent-secondary);
  color: var(--bg);
}

.mo-note {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.mo-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mo-title {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.mo-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mo-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.mo-btn.panel {
  border-style: dashed;
}

.mo-btn.on {
  border-color: var(--pass);
}

.mo-btn.pinned {
  border-color: var(--accent);
}

.mo-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.mo-pin {
  color: var(--accent);
  font-size: 10px;
}

.mo-state {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
  color: var(--muted);
  font-size: 12px;
}

.mo-btn.on .mo-state {
  color: var(--pass);
}

.mo-key {
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 12px;
}
</style>
