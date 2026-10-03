<script setup lang="ts">
import { DECK_PICTURE_TYPES, validateDeckPicture } from "~/utils/deckPicture";

const props = defineProps<{
  deckId: number;
  imageUrl: string | null;
}>();
const emit = defineEmits<{ updated: [imageUrl: string | null] }>();

const input = ref<HTMLInputElement | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

async function onPick(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;

  error.value = validateDeckPicture(file);
  if (error.value) return;

  busy.value = true;
  try {
    const body = new FormData();
    body.append("deckId", String(props.deckId));
    body.append("file", file);
    const res = await $fetch<{ imageUrl: string }>("/api/decks/image", { method: "POST", body });
    emit("updated", res.imageUrl);
  } catch (err) {
    error.value = extractErrorMessage(err, "Couldn't save that picture.");
  } finally {
    busy.value = false;
  }
}

async function remove() {
  busy.value = true;
  error.value = null;
  try {
    await $fetch("/api/decks/image", { method: "DELETE", body: { id: props.deckId } });
    emit("updated", null);
  } catch (err) {
    error.value = extractErrorMessage(err, "Couldn't remove that picture.");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="picture-block">
    <span class="picture-label">Picture</span>
    <input
      ref="input"
      type="file"
      class="picture-input"
      :accept="DECK_PICTURE_TYPES.join(',')"
      :disabled="busy"
      @change="onPick"
    />
    <button type="button" class="picture-btn" :disabled="busy" @click="input?.click()">
      {{ busy ? "Saving..." : imageUrl ? "Replace picture" : "Choose picture" }}
    </button>
    <button v-if="imageUrl" type="button" class="picture-btn picture-remove" :disabled="busy" @click="remove">
      Remove
    </button>
    <p v-if="error" class="picture-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.picture-block {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: -8px 0 12px;
}

.picture-label {
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
}

.picture-input {
  display: none;
}

.picture-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}

.picture-remove {
  border-color: var(--fail);
  color: var(--fail);
}

.picture-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.picture-error {
  flex-basis: 100%;
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
