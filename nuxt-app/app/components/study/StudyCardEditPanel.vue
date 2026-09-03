<script setup lang="ts">
interface CardWithDetails {
  id: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
}

interface ManualDeck {
  id: number;
  name: string;
}

const props = defineProps<{
  card: CardWithDetails;
  manualDecks: ManualDeck[];
  memberships: Record<number, number[]>;
  togglingMembership: Record<string, boolean>;
  deckToggleError: string | null;
}>();
const emit = defineEmits<{
  updated: [card: CardWithDetails];
  "toggle-membership": [deckId: number, checked: boolean];
}>();

const editing = ref(false);
const videoPath = ref("");
const audioPath = ref("");
const saving = ref(false);
const error = ref<string | null>(null);
const clearing = reactive<Record<string, boolean>>({});

function startEdit() {
  videoPath.value = props.card.localVideoPath ?? "";
  audioPath.value = props.card.localAudioPath ?? "";
  error.value = null;
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  error.value = null;
}

async function save() {
  error.value = null;
  saving.value = true;
  try {
    const result = await $fetch<{ card: CardWithDetails }>("/api/cards", {
      method: "PATCH",
      body: {
        id: props.card.id,
        localVideoPath: videoPath.value.trim() === "" ? null : videoPath.value.trim(),
        localAudioPath: audioPath.value.trim() === "" ? null : audioPath.value.trim(),
      },
    });
    editing.value = false;
    emit("updated", result.card);
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to update card.");
  } finally {
    saving.value = false;
  }
}

async function clearLocalPath(kind: "video" | "audio") {
  error.value = null;
  clearing[kind] = true;
  try {
    const body = kind === "video" ? { id: props.card.id, localVideoPath: null } : { id: props.card.id, localAudioPath: null };
    const result = await $fetch<{ card: CardWithDetails }>("/api/cards", { method: "PATCH", body });
    if (kind === "video") videoPath.value = "";
    else audioPath.value = "";
    emit("updated", result.card);
  } catch (err) {
    error.value = extractErrorMessage(err, "Failed to clear local file.");
  } finally {
    clearing[kind] = false;
  }
}
</script>

<template>
  <div class="card-edit-panel">
    <button v-if="!editing" type="button" class="edit-toggle-btn" @click="startEdit">Edit card</button>
    <form v-else class="edit-form" @submit.prevent="save">
      <label class="field">
        <span class="field-label">Local video path</span>
        <div class="path-row">
          <input v-model="videoPath" type="text" placeholder="Blank to clear" :disabled="saving" />
          <button
            type="button"
            class="clear-btn"
            :disabled="!card.localVideoPath || saving || clearing.video"
            @click="clearLocalPath('video')"
          >
            {{ clearing.video ? "Clearing..." : "Clear" }}
          </button>
        </div>
      </label>
      <label class="field">
        <span class="field-label">Local audio path</span>
        <div class="path-row">
          <input v-model="audioPath" type="text" placeholder="Blank to clear" :disabled="saving" />
          <button
            type="button"
            class="clear-btn"
            :disabled="!card.localAudioPath || saving || clearing.audio"
            @click="clearLocalPath('audio')"
          >
            {{ clearing.audio ? "Clearing..." : "Clear" }}
          </button>
        </div>
      </label>

      <div class="field">
        <span class="field-label">Decks</span>
        <DeckMembershipPanel
          :card-id="card.id"
          :decks="manualDecks"
          :memberships="memberships"
          :toggling="togglingMembership"
          :error="deckToggleError"
          @toggle="(deckId, checked) => emit('toggle-membership', deckId, checked)"
        />
      </div>

      <p v-if="error" class="edit-error">{{ error }}</p>

      <div class="edit-actions">
        <button type="submit" class="save-btn" :disabled="saving">Save</button>
        <button type="button" class="cancel-btn" :disabled="saving" @click="cancelEdit">Cancel</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.card-edit-panel {
  display: flex;
  flex-direction: column;
}

.edit-toggle-btn {
  align-self: flex-start;
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  color: var(--faint);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field input[type="text"] {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.field input[type="text"]:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.path-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-row input[type="text"] {
  flex: 1;
  min-width: 0;
}

.clear-btn {
  flex: none;
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--fail);
  background: transparent;
  color: var(--fail);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.clear-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edit-actions {
  display: flex;
  gap: 8px;
}

.save-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.cancel-btn {
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--fail);
  background: transparent;
  color: var(--fail);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.save-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edit-error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
}
</style>
