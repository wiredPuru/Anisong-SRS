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
const emit = defineEmits<{ toggle: [deckId: number, checked: boolean] }>();

function isInDeck(deckId: number): boolean {
  return (props.memberships[props.cardId] ?? []).includes(deckId);
}

function isToggling(deckId: number): boolean {
  return Boolean(props.toggling[`${props.cardId}-${deckId}`]);
}
</script>

<template>
  <div class="decks-panel">
    <p v-if="!decks.length" class="decks-hint">
      No manual decks yet - <NuxtLink to="/decks?type=created">create one on the Decks page</NuxtLink>.
    </p>
    <label v-for="d in decks" :key="d.id" class="deck-checkbox-row">
      <input
        type="checkbox"
        :checked="isInDeck(d.id)"
        :disabled="isToggling(d.id)"
        @change="emit('toggle', d.id, ($event.target as HTMLInputElement).checked)"
      />
      {{ d.name }}
    </label>
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

.decks-hint a {
  color: var(--accent);
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
