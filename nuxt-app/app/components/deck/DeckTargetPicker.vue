<script setup lang="ts">
import type { DeckTarget } from "~/utils/deckTarget";

const target = defineModel<DeckTarget>({ required: true });
defineProps<{ disabled?: boolean }>();

interface DeckOption {
  id: number;
  name: string;
}

const NEW_DECK = "new";
const NO_DECK = "none";

const decks = ref<DeckOption[]>([]);
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    decks.value = (await $fetch<{ decks: DeckOption[] }>("/api/decks", { query: { type: "created" } })).decks;
  } catch (err) {
    loadError.value = extractErrorMessage(err, "Could not load your decks.");
  }
});

// A deck made by this picker is not in the fetched list yet, so it is added.
watch(target, (value) => {
  if (value.mode === "existing" && !decks.value.some((deck) => deck.id === value.deckId)) {
    void $fetch<{ decks: DeckOption[] }>("/api/decks", { query: { type: "created" } })
      .then((reply) => { decks.value = reply.decks; })
      .catch(() => {});
  }
});

const selected = computed(() => {
  if (target.value.mode === "existing") return String(target.value.deckId);
  return target.value.mode === "new" ? NEW_DECK : NO_DECK;
});

function onSelect(value: string) {
  if (value === NO_DECK) target.value = { mode: "none" };
  else if (value === NEW_DECK) target.value = { mode: "new", name: "" };
  else target.value = { mode: "existing", deckId: Number(value) };
}
</script>

<template>
  <div class="deck-target">
    <label class="deck-target-label">
      <span>Also add the cards to a deck</span>
      <select :value="selected" :disabled="disabled" aria-label="Deck to add the cards to" @change="onSelect(($event.target as HTMLSelectElement).value)">
        <option :value="NO_DECK">No deck</option>
        <option v-for="deck in decks" :key="deck.id" :value="String(deck.id)">{{ deck.name }}</option>
        <option :value="NEW_DECK">New deck...</option>
      </select>
    </label>
    <input
      v-if="target.mode === 'new'"
      type="text"
      class="deck-target-name"
      placeholder="New deck name"
      aria-label="New deck name"
      :disabled="disabled"
      :value="target.name"
      @input="target = { mode: 'new', name: ($event.target as HTMLInputElement).value }"
    >
    <p v-if="loadError" class="deck-target-error">{{ loadError }}</p>
  </div>
</template>

<style scoped>
.deck-target {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.deck-target-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
}

select,
.deck-target-name {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.deck-target-error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
}
</style>
