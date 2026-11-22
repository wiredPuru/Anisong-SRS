<script setup lang="ts">
import type { PartyHostState } from "~/composables/usePartyHost";
import { commandStatus, paletteCommandById, type PaletteLocal, type PartyPaletteCommand } from "~/utils/partyPalette";

const props = defineProps<{ state: PartyHostState | null; local: PaletteLocal }>();
const emit = defineEmits<{ pick: [command: PartyPaletteCommand]; more: [] }>();

const { pins } = usePartyHostPins();

const buttons = computed(() =>
  pins.value
    .map(paletteCommandById)
    .filter((command): command is PartyPaletteCommand => command !== null)
    .map((command) => ({ command, ...commandStatus(command, props.state, props.local) })),
);
</script>

<template>
  <div class="pinned" role="group" aria-label="Pinned controls">
    <button
      v-for="button in buttons"
      :key="button.command.id"
      type="button"
      class="pin-btn"
      :class="{ on: button.on, panel: button.command.kind === 'jump' }"
      :disabled="Boolean(button.reason)"
      :title="button.reason ?? (button.command.hotkey ? `${button.command.title} (${button.command.hotkey})` : button.command.title)"
      :aria-pressed="button.on ?? undefined"
      @click="emit('pick', button.command)"
    >
      {{ button.command.title }}
    </button>
    <button type="button" class="pin-btn more" @click="emit('more')">More...</button>
  </div>
</template>

<style scoped>
.pinned {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pin-btn {
  flex: 1 1 auto;
  padding: 7px 10px;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.pin-btn.panel {
  border-style: dashed;
}

.pin-btn.on {
  border-color: var(--pass);
  color: var(--pass);
}

.pin-btn.more {
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
}

.pin-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
