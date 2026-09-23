<script setup lang="ts">
import type { PickedDeckSource } from "./DeckSourcePicker.vue";

export interface CopyCardsResult {
  added: number;
  alreadyInDeck: number;
  missingSources: { type: PickedDeckSource["type"]; id: number }[];
}

// With `create`, the modal makes the deck itself from `name`, then copies into it.
const props = defineProps<{ open: boolean; deckId: number | null; deckName: string; create?: boolean }>();
const emit = defineEmits<{ close: []; copied: [CopyCardsResult]; created: [number] }>();

const picked = ref<PickedDeckSource[]>([]);
const name = ref("");
const createdDeckId = ref<number | null>(null);
const targetDeckId = computed(() => (props.create ? createdDeckId.value : props.deckId));
const canConfirm = computed(
  () => picked.value.length > 0 && (!props.create || createdDeckId.value !== null || name.value.trim() !== ""),
);

const submitting = ref(false);
const error = ref<string | null>(null);
const summary = ref<string | null>(null);

const pickedCardTotal = computed(() => picked.value.reduce((sum, s) => sum + s.cardCount, 0));

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function describe(result: CopyCardsResult): string {
  let text = `Added ${plural(result.added, "card")}`;
  if (result.alreadyInDeck) text += ` (${result.alreadyInDeck} already in deck)`;
  text += ".";
  if (result.missingSources.length) {
    text += ` ${plural(result.missingSources.length, "deck")} no longer exist${result.missingSources.length === 1 ? "s" : ""} and ${result.missingSources.length === 1 ? "was" : "were"} skipped.`;
  }
  return text;
}

// Only a failed create returns null; the error is already shown.
async function ensureTargetDeck(): Promise<number | null> {
  if (!props.create) return props.deckId;
  if (createdDeckId.value !== null) return createdDeckId.value;
  try {
    const res = await $fetch<{ deck: { id: number } }>("/api/decks", { method: "POST", body: { name: name.value.trim() } });
    createdDeckId.value = res.deck.id;
    emit("created", res.deck.id);
    return res.deck.id;
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to create deck.");
    return null;
  }
}

async function confirm() {
  if (!canConfirm.value) return;
  submitting.value = true;
  error.value = null;
  summary.value = null;
  const wasCreated = createdDeckId.value !== null;
  const deckId = await ensureTargetDeck();
  if (deckId === null) {
    submitting.value = false;
    return;
  }
  try {
    const result = await $fetch<CopyCardsResult>("/api/decks/copy-cards", {
      method: "POST",
      body: { deckId, sources: picked.value.map(({ type, id }) => ({ type, id })) },
    });
    summary.value = describe(result);
    picked.value = [];
    emit("copied", result);
  } catch (err) {
    const message = extractErrorMessage(err, "Failed to import cards.");
    // The deck is kept rather than rolled back, so a retry imports into it.
    error.value = props.create && !wasCreated ? `Deck created, but importing cards failed: ${message}` : message;
  } finally {
    submitting.value = false;
  }
}

function close() {
  if (submitting.value) return;
  emit("close");
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      name.value = props.deckName;
      return;
    }
    createdDeckId.value = null;
    picked.value = [];
    error.value = null;
    summary.value = null;
  },
);

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (!props.open || isTypingTarget(event)) return;
  if (event.key === "Escape") close();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="close">
    <div class="panel">
      <button type="button" class="close-btn" aria-label="Close" @click="close">✕</button>

      <h2>{{ create ? "New deck from other decks" : "Import from deck" }}</h2>
      <p v-if="create" class="subtitle">Name the deck, then pick the decks whose cards it starts with.</p>
      <p v-else class="subtitle">
        Copy every card from the decks you pick into {{ deckName }}. Cards already in it are skipped.
      </p>

      <input
        v-if="create"
        v-model="name"
        type="text"
        placeholder="Deck name"
        class="name-input"
        :disabled="submitting || createdDeckId !== null"
      />

      <DeckSourcePicker v-model="picked" :exclude-deck-id="targetDeckId" />

      <p v-if="summary" class="summary">{{ summary }}</p>
      <p v-if="error" class="inline-error">{{ error }}</p>

      <div class="modal-actions">
        <span v-if="picked.length" class="picked-note">
          {{ plural(picked.length, "deck") }}, up to {{ plural(pickedCardTotal, "card") }}
        </span>
        <button type="button" class="cancel-btn" :disabled="submitting" @click="close">
          {{ summary ? "Done" : "Cancel" }}
        </button>
        <button type="button" class="done-btn" :disabled="submitting || !canConfirm" @click="confirm">
          {{ submitting ? "Importing..." : create && createdDeckId === null ? "Create and import" : "Import" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: var(--z-modal);
}

.panel {
  position: relative;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px;
  border-radius: var(--radius);
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
}

.panel > * {
  flex-shrink: 0;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
}

h2 {
  margin: 0 24px 0 0;
  font-size: 20px;
  font-weight: 800;
}

.subtitle {
  margin: -4px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.name-input {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.name-input:disabled {
  opacity: 0.6;
}

.summary {
  margin: 0;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--pass);
  color: var(--text);
  font-size: 14px;
}

.inline-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.picked-note {
  margin-right: auto;
  color: var(--muted);
  font-size: 13px;
}

.cancel-btn,
.done-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.cancel-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
}

.done-btn {
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
}

.cancel-btn:disabled,
.done-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
