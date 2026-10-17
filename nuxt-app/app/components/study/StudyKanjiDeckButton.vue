<script setup lang="ts">
const props = defineProps<{ char: string }>();

const deck = useKanjiDeck();
const added = computed(() => deck.chars.value.has(props.char));
const busy = computed(() => deck.pending.value.has(props.char));

onMounted(() => {
  if (!deck.loaded.value) deck.load();
});

function toggle() {
  if (added.value) deck.remove(props.char);
  else deck.add(props.char);
}
</script>

<template>
  <button
    type="button"
    class="kdb"
    :class="{ added }"
    :disabled="busy"
    :aria-pressed="added"
    :aria-label="added ? `Remove ${char} from Kanji Study` : `Add ${char} to Kanji Study`"
    @click="toggle"
  >
    {{ busy ? "..." : added ? "Added" : "Add to Kanji Study" }}
  </button>
</template>

<style scoped>
.kdb {
  align-self: flex-start;
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--muted);
  font: 600 12px var(--font-sans);
  cursor: pointer;
}

.kdb:hover {
  border-color: var(--accent);
  color: var(--text);
}

.kdb.added {
  border-color: var(--pass);
  color: var(--pass);
}

.kdb:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
