<script setup lang="ts">
import type { PartyHostCommand, PartyHostState, PartyRevealFields } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const FIELDS: { key: keyof PartyRevealFields; label: string }[] = [
  { key: "anime", label: "Anime title" },
  { key: "artist", label: "Artist" },
  { key: "song", label: "Song name" },
  { key: "slot", label: "OP/ED number" },
];

const allOn = computed(() => FIELDS.every(({ key }) => props.state.revealFields[key]));

function toggle(key: keyof PartyRevealFields, value: boolean) {
  emit("command", { type: "revealFields", fields: { ...props.state.revealFields, [key]: value } });
}

function setAll(value: boolean) {
  emit("command", { type: "revealFields", fields: { anime: value, artist: value, song: value, slot: value } });
}
</script>

<template>
  <section class="reveal-panel" aria-labelledby="reveal-fields-title">
    <h2 id="reveal-fields-title" class="reveal-panel-title">Show on reveal</h2>
    <label class="reveal-check">
      <input type="checkbox" :checked="allOn" @change="setAll(($event.target as HTMLInputElement).checked)" />
      Show all
    </label>
    <label v-for="field in FIELDS" :key="field.key" class="reveal-check">
      <input
        type="checkbox"
        :checked="state.revealFields[field.key]"
        @change="toggle(field.key, ($event.target as HTMLInputElement).checked)"
      />
      {{ field.label }}
    </label>
    <p class="reveal-panel-hint">Unchecked parts are never sent to the screen or phones.</p>
  </section>
</template>

<style scoped>
.reveal-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reveal-panel-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.reveal-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
}

.reveal-panel-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
</style>
