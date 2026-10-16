<script setup lang="ts">
const props = defineProps<{ cardId: number }>();
const emit = defineEmits<{ close: [] }>();

interface CardFields {
  songTitle: string;
  themeSlot: string;
  artistName: string;
  notes: string | null;
}

const form = ref({ songTitle: "", themeSlot: "", artistName: "", notes: "" });
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const fields = await $fetch<CardFields>("/api/party/host/card-edit", { query: { cardId: props.cardId } });
    form.value = { songTitle: fields.songTitle, themeSlot: fields.themeSlot, artistName: fields.artistName, notes: fields.notes ?? "" };
  } catch {
    error.value = "Couldn't load this card.";
  } finally {
    loading.value = false;
  }
});

async function save() {
  saving.value = true;
  error.value = null;
  try {
    await $fetch("/api/party/host/card-edit", { method: "POST", body: { cardId: props.cardId, ...form.value } });
    emit("close");
  } catch (err) {
    error.value = (err as { statusMessage?: string }).statusMessage ?? "Couldn't save the card.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
      <form class="panel" @submit.prevent="save">
        <button type="button" class="close-btn" aria-label="Close" @click="emit('close')">&#10005;</button>
        <h2 class="title">Edit card</h2>
        <p v-if="loading" class="hint">Loading...</p>
        <p v-else-if="error && !form.songTitle" class="error" role="alert">{{ error }}</p>
        <template v-else>
          <label class="field">Song title<input v-model="form.songTitle" type="text" required></label>
          <label class="field">Theme slot<input v-model="form.themeSlot" type="text" required></label>
          <label class="field">Artist (this song only)<input v-model="form.artistName" type="text" required></label>
          <label class="field">Notes<textarea v-model="form.notes" rows="3" /></label>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <button type="submit" class="save-btn" :disabled="saving">{{ saving ? "Saving..." : "Save" }}</button>
        </template>
      </form>
    </div>
  </Teleport>
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
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 28px;
  border-radius: calc(var(--radius) + 8px);
  background: var(--bg);
  border: 1px solid var(--outline);
  box-shadow: var(--shadow-soft);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--muted);
}

.field input,
.field textarea {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
}

.hint {
  margin: 0;
  color: var(--muted);
}

.save-btn {
  align-self: flex-end;
  padding: 6px 18px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 700;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
