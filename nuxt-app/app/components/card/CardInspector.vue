<script setup lang="ts">
interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  notes: string | null;
  box: number;
  nextReviewAt: string;
  createdAt: string;
  songTitle: string;
  themeSlot: string;
  artistId: number;
  artistName: string;
  animeId: number;
  animeAniListId: number;
  animeAnimethemesSlug: string | null;
  animethemesVideoSlug: string | null;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}

interface ManualDeck {
  id: number;
  name: string;
}

const props = withDefaults(
  defineProps<{
    card: CardWithDetails | null;
    audioOnly: boolean;
    hasDefaultDownloadFolder: boolean;
    autoDownload: boolean;
    clipSource: "anisongdb" | "both" | "animethemes";
    manualDecks: ManualDeck[];
    memberships: Record<number, number[]>;
    togglingMembership: Record<string, boolean>;
    membershipError: string | null;
    // The deck page being viewed; its own artist or anime is shown as plain
    // text, since linking to the page you are on is noise.
    currentDeck?: { type: "artist" | "anime" | "created"; id: number } | null;
    showSchedule?: boolean;
    // A manual deck says the card leaves the whole library, not just the deck.
    deleteConfirmText?: string;
  }>(),
  {
    currentDeck: null,
    showSchedule: true,
    deleteConfirmText: "Delete this card? This also removes its downloaded files.",
  },
);

const emit = defineEmits<{
  updated: [card: CardWithDetails];
  deleted: [id: number];
  "toggle-deck": [cardId: number, deckId: number, checked: boolean];
}>();

function isCurrentDeck(type: "artist" | "anime", id: number): boolean {
  return props.currentDeck?.type === type && props.currentDeck.id === id;
}

const sourceLinks = computed(() => (props.card ? buildSourceLinks(props.card) : []));

// Reset per card so expanding one card does not carry into the next selection.
const immersive = ref(false);
watch(
  () => props.card?.id,
  () => {
    immersive.value = false;
  },
);

function onLocalPathUpdated({ kind, localPath }: { kind: "video" | "audio"; localPath: string }) {
  if (!props.card) return;
  emit("updated", {
    ...props.card,
    ...(kind === "video" ? { localVideoPath: localPath } : { localAudioPath: localPath }),
  });
}

function onLocalPathCleared({ kind }: { kind: "video" | "audio" }) {
  if (!props.card) return;
  emit("updated", {
    ...props.card,
    ...(kind === "video" ? { localVideoPath: null } : { localAudioPath: null }),
  });
}

const editingId = ref<number | null>(null);
const editVideoPath = ref("");
const editAudioPath = ref("");
const editNotes = ref("");
const editSaving = ref(false);
const editError = ref<string | null>(null);
const clearingField = reactive<Record<string, boolean>>({});
const removeCardError = reactive<Record<number, string | null>>({});
const confirmingRemoveId = ref<number | null>(null);
const removingCard = ref(false);

const {
  downloading,
  downloadProgress,
  downloadError,
  downloadKey,
  canDownload,
  hasAnyDownloadableSource,
  downloadMedia: downloadMediaBase,
} = useCardDownloads();

async function downloadMedia(c: CardWithDetails, kind: "video" | "audio") {
  const updated = await downloadMediaBase<CardWithDetails>(c.id, c.id, kind);
  if (updated) {
    emit("updated", updated);
    if (editingId.value === c.id) {
      editVideoPath.value = updated.localVideoPath ?? "";
      editAudioPath.value = updated.localAudioPath ?? "";
    }
  }
}

function startEdit(c: CardWithDetails) {
  editingId.value = c.id;
  editVideoPath.value = c.localVideoPath ?? "";
  editAudioPath.value = c.localAudioPath ?? "";
  editNotes.value = c.notes ?? "";
  editError.value = null;
}

function cancelEdit() {
  editingId.value = null;
  editError.value = null;
}

async function saveEdit(id: number) {
  editError.value = null;
  editSaving.value = true;
  try {
    const result = await $fetch<{ card: CardWithDetails }>("/api/cards", {
      method: "PATCH",
      body: {
        id,
        localVideoPath: editVideoPath.value.trim() === "" ? null : editVideoPath.value.trim(),
        localAudioPath: editAudioPath.value.trim() === "" ? null : editAudioPath.value.trim(),
        notes: editNotes.value.trim() === "" ? null : editNotes.value.trim(),
      },
    });
    editingId.value = null;
    emit("updated", result.card);
  } catch (err) {
    editError.value = extractErrorMessage(err, "Failed to update card.");
  } finally {
    editSaving.value = false;
  }
}

async function clearLocalPath(c: CardWithDetails, kind: "video" | "audio") {
  const key = `${c.id}-${kind}`;
  editError.value = null;
  clearingField[key] = true;
  try {
    const body = kind === "video" ? { id: c.id, localVideoPath: null } : { id: c.id, localAudioPath: null };
    const result = await $fetch<{ card: CardWithDetails }>("/api/cards", { method: "PATCH", body });
    if (kind === "video") editVideoPath.value = "";
    else editAudioPath.value = "";
    emit("updated", result.card);
  } catch (err) {
    editError.value = extractErrorMessage(err, "Failed to clear local file.");
  } finally {
    clearingField[key] = false;
  }
}

async function removeCard(id: number) {
  removeCardError[id] = null;
  removingCard.value = true;
  try {
    await $fetch("/api/cards", { method: "DELETE", body: { id } });
    // The parent drops the row, which also closes the rail.
    emit("deleted", id);
  } catch (err) {
    removeCardError[id] = extractErrorMessage(err, "Failed to delete card.");
  } finally {
    removingCard.value = false;
    confirmingRemoveId.value = null;
  }
}
</script>

<template>
  <div class="card-inspector">
    <div v-if="!card" class="inspector-empty">
      <MascotState pose="point" size="companion">Select a card to see its details.</MascotState>
    </div>
    <template v-else>
      <!-- The rail is the preview now: a real player rather than a still.
           A card with no source at all has nothing to play, so it keeps
           the plain cover tile. -->
      <StudyMediaPlayer
        v-if="sourceBadges(card).length"
        :key="card.id"
        :card="card"
        :audio-only="audioOnly"
        :has-default-download-folder="hasDefaultDownloadFolder"
        :auto-download="autoDownload"
        :clip-source="clipSource"
        :allow-expand="true"
        v-model:immersive="immersive"
        @local-path-updated="onLocalPathUpdated"
        @local-path-cleared="onLocalPathCleared"
      />
      <div v-else class="inspector-cover">
        <img v-if="card.animeCoverImageUrl" :src="card.animeCoverImageUrl" alt="" />
        <span class="inspector-slot">{{ formatThemeSlotLabel(card.themeSlot) }}</span>
      </div>
      <div class="inspector-body">
        <div class="inspector-titles">
          <span class="inspector-song">{{ card.songTitle }}</span>
          <span v-if="isCurrentDeck('artist', card.artistId)" class="inspector-meta">{{ card.artistName }}</span>
          <NuxtLink v-else :to="artistDeckPath(card.artistId)" class="inspector-meta deck-link">{{
            card.artistName
          }}</NuxtLink>
          <span v-if="isCurrentDeck('anime', card.animeId)" class="inspector-meta">{{ card.animeTitleEnglish }}</span>
          <NuxtLink v-else :to="animeDeckPath(card.animeId)" class="inspector-meta deck-link">{{
            card.animeTitleEnglish
          }}</NuxtLink>
        </div>

        <div v-if="showSchedule" class="inspector-tiles">
          <div class="tile">
            <span class="tile-value" :class="{ 'due-now': isDueNow(card) }">{{
              dueLabel(card)
            }}</span>
            <span class="tile-label">Due</span>
          </div>
          <div class="tile">
            <span class="tile-value tile-value-box">Box {{ card.box }}</span>
            <span class="tile-label">Leitner</span>
          </div>
        </div>

        <div v-if="card.notes" class="inspector-block">
          <span class="block-label">Notes</span>
          <span class="notes-row">{{ card.notes }}</span>
        </div>

        <div v-if="sourceLinks.length" class="inspector-block">
          <span class="block-label">Links</span>
          <CardSourceLinks :links="sourceLinks" />
        </div>

        <div class="inspector-block">
          <span class="block-label">Sources</span>
          <span v-for="badge in sourceBadges(card)" :key="badge" class="source-row">{{ badge }}</span>
          <span v-if="!sourceBadges(card).length" class="source-row source-row-none">No source</span>
        </div>

        <div v-if="hasAnyDownloadableSource(card)" class="download-section">
          <div v-if="hasDefaultDownloadFolder" class="download-actions">
            <template v-for="kind in (['video', 'audio'] as const)" :key="kind">
              <template v-if="canDownload(card, kind)">
                <DownloadProgress
                  v-if="downloading[downloadKey(card.id, kind)]"
                  :label="`Downloading ${kind}`"
                  :request-key="downloadKey(card.id, kind)"
                  :progress="downloadProgress[downloadKey(card.id, kind)]"
                />
                <button v-else type="button" class="download-btn" @click="downloadMedia(card, kind)">
                  Download {{ kind }}
                </button>
              </template>
            </template>
          </div>
          <p v-else class="download-hint">
            Set a <NuxtLink to="/settings">default download folder</NuxtLink> to enable downloads.
          </p>
          <p v-if="downloadError[card.id]" class="edit-error">{{ downloadError[card.id] }}</p>
        </div>

        <div class="inspector-block">
          <span class="block-label">Decks</span>
          <DeckMembershipPanel
            :card-id="card.id"
            :decks="manualDecks"
            :memberships="memberships"
            :toggling="togglingMembership"
            :error="membershipError"
            @toggle="(deckId, checked) => emit('toggle-deck', card!.id, deckId, checked)"
          />
        </div>

        <div v-if="editingId === card.id" class="edit-form">
          <div class="path-row">
            <input
              v-model="editVideoPath"
              type="text"
              placeholder="Local video path (blank to clear)"
              :disabled="editSaving"
              class="path-input"
            />
            <button
              type="button"
              class="clear-btn"
              :disabled="!card.localVideoPath || editSaving || clearingField[`${card.id}-video`]"
              @click="clearLocalPath(card, 'video')"
            >
              {{ clearingField[`${card.id}-video`] ? "Clearing..." : "Clear" }}
            </button>
          </div>
          <div class="path-row">
            <input
              v-model="editAudioPath"
              type="text"
              placeholder="Local audio path (blank to clear)"
              :disabled="editSaving"
              class="path-input"
            />
            <button
              type="button"
              class="clear-btn"
              :disabled="!card.localAudioPath || editSaving || clearingField[`${card.id}-audio`]"
              @click="clearLocalPath(card, 'audio')"
            >
              {{ clearingField[`${card.id}-audio`] ? "Clearing..." : "Clear" }}
            </button>
          </div>
          <div class="notes-field">
            <span class="block-label">Notes</span>
            <textarea
              v-model="editNotes"
              rows="3"
              placeholder="A memory hook for this card"
              :disabled="editSaving"
              class="path-input"
            />
          </div>
          <div class="edit-actions">
            <button type="button" class="save-btn" :disabled="editSaving" @click="saveEdit(card.id)">
              Save
            </button>
            <button type="button" class="cancel-btn" :disabled="editSaving" @click="cancelEdit">Cancel</button>
          </div>
          <p v-if="editError" class="edit-error">{{ editError }}</p>
        </div>

        <div v-else-if="confirmingRemoveId === card.id" class="inspector-actions">
          <span class="confirm-label">{{ deleteConfirmText }}</span>
          <button type="button" class="confirm-btn" :disabled="removingCard" @click="removeCard(card.id)">
            {{ removingCard ? "Deleting..." : "Confirm" }}
          </button>
          <button
            type="button"
            class="selection-clear-btn"
            :disabled="removingCard"
            @click="confirmingRemoveId = null"
          >
            Cancel
          </button>
        </div>
        <div v-else class="inspector-actions">
          <button type="button" class="edit-btn" @click="startEdit(card)">Edit card</button>
          <slot name="actions" :card="card" />
          <button type="button" class="remove-btn" @click="confirmingRemoveId = card.id">Delete</button>
        </div>
        <p v-if="removeCardError[card.id]" class="edit-error">{{ removeCardError[card.id] }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.inspector-empty {
  padding: 26px;
  color: var(--muted);
  font-size: 13px;
}

/* The player fills the top of the rail as one flush tile, like the artboard's
   preview block - no card padding, no rounded corners, just a bottom edge.
   Skipped while expanded, where it is a fixed full-viewport overlay. */
.card-inspector > :deep(.player-card:not(.expanded)) {
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  box-shadow: none;
}

.card-inspector > :deep(.player-card:not(.expanded)) .player-frame {
  border: 0;
  border-radius: 0;
}

.inspector-cover {
  position: relative;
  aspect-ratio: 16 / 9;
  background:
    radial-gradient(120% 120% at 30% 20%, var(--accent-glow), transparent 55%),
    radial-gradient(120% 120% at 80% 80%, var(--accent-secondary-glow), transparent 55%),
    var(--surface);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}

.inspector-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.85;
}

.inspector-slot {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 3px 10px;
  border-radius: calc(var(--radius-sm) - 1px);
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  border: 1px solid var(--border);
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-secondary);
}

.inspector-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.inspector-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inspector-song {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
  line-height: 1.2;
}

.inspector-meta {
  font-size: 14px;
  color: var(--muted);
}

.inspector-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.tile {
  padding: 12px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tile-value {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 400;
  line-height: 1;
  color: var(--muted);
}

.tile-value.due-now {
  color: var(--accent);
}

.tile-value-box {
  color: var(--pass);
}

.tile-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--faint);
}

.inspector-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--faint);
}

.source-row {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 13px;
}

.source-row-none {
  color: var(--fail);
  border-color: var(--fail);
}

/* Free text rather than a badge, so it wraps and keeps the line breaks the
   user typed instead of the single-line treatment .source-row gets. */
.notes-row {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 13px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.inspector-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.inspector-actions .preview-btn,
.inspector-actions .edit-btn {
  flex: 1;
}

.inspector-actions .confirm-label {
  flex-basis: 100%;
}

.inspector-actions button:disabled {
  opacity: 0.5;
  cursor: default;
}

.preview-btn,
.edit-btn,
.save-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.remove-btn,
.cancel-btn {
  padding: 6px 14px;
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

.edit-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 320px;
}

.path-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notes-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

textarea.path-input {
  resize: vertical;
}

.path-input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
}

.path-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
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

.edit-error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
}

.download-section {
  margin-top: 6px;
}

.download-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.download-btn {
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent-secondary);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.download-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.download-hint a {
  color: var(--accent);
}


.selection-clear-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.confirm-label {
  flex-basis: 100%;
}

.confirm-btn {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--fail);
  color: var(--fail-ink);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}
</style>
