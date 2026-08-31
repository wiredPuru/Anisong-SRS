<script setup lang="ts">
interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  box: number;
  nextReviewAt: string;
  createdAt: string;
  songTitle: string;
  songTitleNative: string;
  themeSlot: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}

interface ManualDeck {
  id: number;
  name: string;
}

const props = defineProps<{
  card: CardWithDetails | null;
  open: boolean;
  hasDefaultDownloadFolder?: boolean;
  audioOnly?: boolean;
}>();
const emit = defineEmits<{ close: []; updated: [card: CardWithDetails] }>();

function onLocalPathUpdated({ kind, localPath }: { kind: "video" | "audio"; localPath: string }) {
  if (!props.card) return;
  emit("updated", {
    ...props.card,
    ...(kind === "video" ? { localVideoPath: localPath } : { localAudioPath: localPath }),
  });
}

const { isTypingTarget } = useHotkeyGuard();

const immersive = ref(false);

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event)) return;
  if (event.key === "Escape") {
    // Two-step: StudyMediaPlayer's own Escape handling collapses immersive
    // first (v-model:immersive below); only close once that's already off,
    // so this handler and that one don't both fire the same keypress.
    if (immersive.value) return;
    emit("close");
  } else if (event.key.toLowerCase() === "e" && !editing.value) {
    immersive.value = !immersive.value;
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

const AMBIENT_STORAGE_KEY = "gaqSrs:previewAmbient";
const ambientMode = ref(false);

onMounted(() => {
  try {
    ambientMode.value = localStorage.getItem(AMBIENT_STORAGE_KEY) === "1";
  } catch {
    ambientMode.value = false;
  }
});

const { setAmbientGlass } = useAmbientGlass();
watch(
  () => ambientMode.value && props.open,
  (active) => setAmbientGlass(active),
  { immediate: true },
);

function toggleAmbient() {
  ambientMode.value = !ambientMode.value;
  try {
    localStorage.setItem(AMBIENT_STORAGE_KEY, ambientMode.value ? "1" : "0");
  } catch {
    // localStorage unavailable (private browsing, locked-down environment) -
    // the toggle still works for this session, it just won't persist.
  }
}

const editing = ref(false);
const editSongTitle = ref("");
const editThemeSlot = ref("");
const editArtistMode = ref<"rename" | "reassign">("rename");
const editArtistName = ref("");
const editVideoPath = ref("");
const editAudioPath = ref("");
const editSaving = ref(false);
const editError = ref<string | null>(null);
const clearingVideo = ref(false);
const clearingAudio = ref(false);

const manualDecks = ref<ManualDeck[]>([]);
const cardMemberships = ref<Record<number, number[]>>({});
const togglingMembership = reactive<Record<string, boolean>>({});
const deckToggleError = ref<string | null>(null);

async function loadDeckData() {
  try {
    const [decksResult, membershipsResult] = await Promise.all([
      $fetch<{ decks: ManualDeck[] }>("/api/decks", { query: { type: "created" } }),
      $fetch<{ memberships: Record<number, number[]> }>("/api/decks/memberships"),
    ]);
    manualDecks.value = decksResult.decks;
    cardMemberships.value = membershipsResult.memberships;
  } catch (err) {
    deckToggleError.value = extractErrorMessage(err, "Failed to load decks.");
  }
}

async function toggleDeckMembership(deckId: number, checked: boolean) {
  if (!props.card) return;
  const cardId = props.card.id;
  const key = `${cardId}-${deckId}`;
  deckToggleError.value = null;
  togglingMembership[key] = true;
  try {
    await $fetch("/api/decks/cards", {
      method: checked ? "POST" : "DELETE",
      body: { deckId, cardId },
    });
    const membershipsResult = await $fetch<{ memberships: Record<number, number[]> }>("/api/decks/memberships");
    cardMemberships.value = membershipsResult.memberships;
  } catch (err) {
    deckToggleError.value = extractErrorMessage(err, "Failed to update deck membership.");
  } finally {
    togglingMembership[key] = false;
  }
}

function startEdit() {
  if (!props.card) return;
  editSongTitle.value = props.card.songTitle;
  editThemeSlot.value = props.card.themeSlot;
  editArtistMode.value = "rename";
  editArtistName.value = props.card.artistName;
  editVideoPath.value = props.card.localVideoPath ?? "";
  editAudioPath.value = props.card.localAudioPath ?? "";
  editError.value = null;
  editing.value = true;
  loadDeckData();
}

function cancelEdit() {
  editing.value = false;
  editError.value = null;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { statusMessage?: string } }).data;
    if (data?.statusMessage) return data.statusMessage;
  }
  return fallback;
}

async function saveEdit() {
  if (!props.card) return;
  editError.value = null;
  editSaving.value = true;
  try {
    const result = await $fetch<{ card: CardWithDetails }>("/api/cards", {
      method: "PATCH",
      body: {
        id: props.card.id,
        songTitle: editSongTitle.value,
        themeSlot: editThemeSlot.value,
        artistMode: editArtistMode.value,
        artistName: editArtistName.value,
        localVideoPath: editVideoPath.value.trim() === "" ? null : editVideoPath.value.trim(),
        localAudioPath: editAudioPath.value.trim() === "" ? null : editAudioPath.value.trim(),
      },
    });
    editing.value = false;
    emit("updated", result.card);
  } catch (err) {
    editError.value = extractErrorMessage(err, "Failed to update card.");
  } finally {
    editSaving.value = false;
  }
}

async function clearLocalPath(kind: "video" | "audio") {
  if (!props.card) return;
  editError.value = null;
  const busyRef = kind === "video" ? clearingVideo : clearingAudio;
  busyRef.value = true;
  try {
    const body =
      kind === "video" ? { id: props.card.id, localVideoPath: null } : { id: props.card.id, localAudioPath: null };
    const result = await $fetch<{ card: CardWithDetails }>("/api/cards", { method: "PATCH", body });
    if (kind === "video") editVideoPath.value = "";
    else editAudioPath.value = "";
    emit("updated", result.card);
  } catch (err) {
    editError.value = extractErrorMessage(err, "Failed to clear local file.");
  } finally {
    busyRef.value = false;
  }
}

watch(
  () => props.card?.id,
  () => {
    editing.value = false;
    editError.value = null;
    immersive.value = false;
  },
);
</script>

<template>
  <div v-if="open && card" class="backdrop" @click.self="emit('close')">
    <div class="panel" :class="{ 'ambient-glass': ambientMode, immersive }">
      <button
        type="button"
        class="ambient-btn"
        :class="{ active: ambientMode }"
        :aria-label="ambientMode ? 'Turn off ambient glow' : 'Turn on ambient glow'"
        @click="toggleAmbient"
      >
        ✨
      </button>
      <button type="button" class="close-btn" @click="emit('close')">✕</button>
      <StudyMediaPlayer
        :card="card"
        :ambient="ambientMode"
        :allow-expand="!editing"
        :has-default-download-folder="hasDefaultDownloadFolder"
        :audio-only="audioOnly"
        v-model:immersive="immersive"
        @local-path-updated="onLocalPathUpdated"
      >
        <template v-if="immersive" #immersive>
          <div class="info-slot">
            <StudyInfoPanel
              :immersive="true"
              :song-title="card.songTitle"
              :song-title-native="card.songTitleNative"
              :artist-name="card.artistName"
              :anime-title-english="card.animeTitleEnglish"
              :anime-title-romaji="card.animeTitleRomaji"
              :anime-title-native="card.animeTitleNative"
              :ambient="ambientMode"
            />
          </div>
        </template>
      </StudyMediaPlayer>

      <form v-if="editing" class="edit-form" @submit.prevent="saveEdit">
        <label class="field">
          <span class="field-label">Song title</span>
          <input v-model="editSongTitle" type="text" :disabled="editSaving" />
        </label>
        <label class="field">
          <span class="field-label">Theme slot</span>
          <input v-model="editThemeSlot" type="text" :disabled="editSaving" />
        </label>

        <div class="field">
          <span class="field-label">Artist</span>
          <div class="artist-mode-row">
            <label class="radio-row">
              <input v-model="editArtistMode" type="radio" value="rename" :disabled="editSaving" />
              Rename this artist everywhere
            </label>
            <label class="radio-row">
              <input v-model="editArtistMode" type="radio" value="reassign" :disabled="editSaving" />
              Use a different artist
            </label>
          </div>
          <input
            v-model="editArtistName"
            type="text"
            :placeholder="editArtistMode === 'rename' ? 'New name for this artist' : 'Existing or new artist name'"
            :disabled="editSaving"
          />
        </div>

        <label class="field">
          <span class="field-label">Local video path</span>
          <div class="path-row">
            <input v-model="editVideoPath" type="text" placeholder="Blank to clear" :disabled="editSaving" />
            <button
              type="button"
              class="clear-btn"
              :disabled="!card.localVideoPath || editSaving || clearingVideo"
              @click="clearLocalPath('video')"
            >
              {{ clearingVideo ? "Clearing..." : "Clear" }}
            </button>
          </div>
        </label>
        <label class="field">
          <span class="field-label">Local audio path</span>
          <div class="path-row">
            <input v-model="editAudioPath" type="text" placeholder="Blank to clear" :disabled="editSaving" />
            <button
              type="button"
              class="clear-btn"
              :disabled="!card.localAudioPath || editSaving || clearingAudio"
              @click="clearLocalPath('audio')"
            >
              {{ clearingAudio ? "Clearing..." : "Clear" }}
            </button>
          </div>
        </label>

        <DeckMembershipPanel
          :card-id="card.id"
          :decks="manualDecks"
          :memberships="cardMemberships"
          :toggling="togglingMembership"
          :error="deckToggleError"
          @toggle="toggleDeckMembership"
        />

        <p v-if="editError" class="edit-error">{{ editError }}</p>

        <div class="edit-actions">
          <button type="submit" class="save-btn" :disabled="editSaving">Save</button>
          <button type="button" class="cancel-btn" :disabled="editSaving" @click="cancelEdit">Cancel</button>
        </div>
      </form>
      <template v-else-if="!immersive">
        <StudyInfoPanel
          :song-title="card.songTitle"
          :song-title-native="card.songTitleNative"
          :artist-name="card.artistName"
          :anime-title-english="card.animeTitleEnglish"
          :anime-title-romaji="card.animeTitleRomaji"
          :anime-title-native="card.animeTitleNative"
          :ambient="ambientMode"
        />
        <button type="button" class="edit-toggle-btn" @click="startEdit">Edit card</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 6, 15, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 50;
}

.panel {
  position: relative;
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 28px;
  border-radius: var(--radius);
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
}

.panel.ambient-glass {
  background: var(--glass-surface);
  border-color: var(--glass-border);
  backdrop-filter: var(--glass-blur);
}

/* overflow: visible isn't load-bearing on its own (kept for safety/harmless),
   but backdrop-filter is: .panel.ambient-glass sets backdrop-filter, which
   creates a new containing block for position: fixed descendants in current
   browsers (same mechanism as `filter`) - so StudyMediaPlayer's
   .player-card.expanded resolved its fixed positioning against .panel's own
   box instead of the viewport. .panel's other content collapses to ~0
   height while immersive (nothing else renders in-flow then), so the
   "fullscreen" player inherited that collapsed size instead. /study never
   hits this since nothing in its ancestor chain uses backdrop-filter or
   overflow. Confirmed via DevTools: .player-card.expanded's computed width
   was exactly .panel's own max-width (638px), not the viewport. */
.panel.immersive {
  overflow: visible;
  backdrop-filter: none;
}

/* StudyMediaPlayer.vue's own .player-card.expanded reserves top:
   var(--nav-height) so /study's persistent nav bar stays visible above its
   page-level immersive mode. Preview is a modal, not a page - .backdrop
   already covers the full viewport (including the nav bar) before
   immersive even starts, so there's nothing to leave room for; reserving
   that space here just left a visible gap at the top. !important to
   reliably beat StudyMediaPlayer.vue's own scoped rule, matching the same
   pattern study/index.vue's :deep() overrides already use. */
.panel :deep(.player-card.expanded) {
  top: 0 !important;
}

.close-btn,
.ambient-btn {
  position: absolute;
  top: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
  z-index: 1;
}

.close-btn {
  right: 16px;
}

.ambient-btn {
  right: 60px;
}

.ambient-btn.active {
  border-color: var(--accent-secondary);
  box-shadow: 0 0 14px var(--accent-secondary-glow);
}

/* Rendered through StudyMediaPlayer.vue's "immersive" slot, so this is a
   real DOM child of .player-frame (position: relative) - same offsets as
   study/index.vue's own .info-slot, kept in sync deliberately so Preview's
   immersive overlay looks and scales identically to /study's (both inherit
   the same proportional cqw-based sizing from StudyInfoPanel.vue's
   .info-card.overlay styles, since it's the same component). */
.info-slot {
  position: absolute;
  top: 7.36%;
  left: 1.1%;
  max-width: 55%;
  max-height: 67%;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 10;
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
  padding: 22px;
  border-radius: var(--radius);
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

.artist-mode-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 4px;
}

.radio-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  cursor: pointer;
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
