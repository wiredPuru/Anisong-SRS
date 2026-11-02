<script setup lang="ts">
interface ManualDeck {
  id: number;
  name: string;
}

const props = defineProps<{
  cardId: number;
  decks: ManualDeck[];
  memberships: Record<number, number[]>;
  toggling: Record<string, boolean>;
  error: string | null;
}>();
const emit = defineEmits<{
  toggle: [deckId: number, checked: boolean];
  created: [deck: ManualDeck];
}>();

const newName = ref("");
const creating = ref(false);
const createError = ref<string | null>(null);

// `created` goes out before `toggle` so a host has the deck in its list by the
// time the checkbox for it renders.
async function createDeck() {
  const name = newName.value.trim();
  if (!name || creating.value) return;
  creating.value = true;
  createError.value = null;
  try {
    const { deck } = await $fetch<{ deck: ManualDeck }>("/api/decks", { method: "POST", body: { name } });
    newName.value = "";
    emit("created", { id: deck.id, name: deck.name });
    emit("toggle", deck.id, true);
  } catch (err) {
    createError.value = extractErrorMessage(err, "Failed to create the deck.");
  } finally {
    creating.value = false;
  }
}

function isInDeck(deckId: number): boolean {
  return (props.memberships[props.cardId] ?? []).includes(deckId);
}

function isToggling(deckId: number): boolean {
  return Boolean(props.toggling[`${props.cardId}-${deckId}`]);
}
</script>

<template>
  <div class="decks-panel">
    <p v-if="!decks.length" class="decks-hint">No manual decks yet. Create one below.</p>
    <label v-for="d in decks" :key="d.id" class="deck-checkbox-row">
      <!-- Explicit pending state lets a failed write restore the checkbox. -->
      <input
        type="checkbox"
        :checked="isToggling(d.id) ? !isInDeck(d.id) : isInDeck(d.id)"
        :disabled="isToggling(d.id)"
        @change="emit('toggle', d.id, ($event.target as HTMLInputElement).checked)"
      />
      {{ d.name }}
    </label>
    <div class="new-deck-row">
      <input
        v-model="newName"
        type="text"
        class="new-deck-input"
        placeholder="New deck name"
        aria-label="New deck name"
        :disabled="creating"
        @keydown.enter.prevent="createDeck"
      />
      <button type="button" class="new-deck-btn" :disabled="creating || !newName.trim()" @click="createDeck">
        {{ creating ? "Creating..." : "Create" }}
      </button>
    </div>
    <p v-if="createError" class="edit-error">{{ createError }}</p>
    <p v-if="error" class="edit-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.decks-panel {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.decks-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.new-deck-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.new-deck-input {
  flex: 1;
  min-width: 0;
}

.new-deck-btn {
  flex-shrink: 0;
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.new-deck-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.deck-checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}

.edit-error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
}
</style>
