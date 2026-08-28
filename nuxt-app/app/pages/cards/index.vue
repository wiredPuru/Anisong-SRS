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
  themeSlot: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
}

const { data, pending, error, refresh } = await useFetch<{ cards: CardWithDetails[] }>("/api/cards");

const editingId = ref<number | null>(null);
const editVideoPath = ref("");
const editAudioPath = ref("");
const editSaving = ref(false);
const editError = ref<string | null>(null);

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { statusMessage?: string } }).data;
    if (data?.statusMessage) return data.statusMessage;
  }
  return fallback;
}

function sourceBadges(c: CardWithDetails): string[] {
  const badges: string[] = [];
  if (c.localVideoPath) badges.push("Local video");
  if (c.localAudioPath) badges.push("Local audio");
  if (c.animethemesVideoUrl) badges.push("Remote video");
  if (c.animethemesAudioUrl) badges.push("Remote audio");
  return badges;
}

function startEdit(c: CardWithDetails) {
  editingId.value = c.id;
  editVideoPath.value = c.localVideoPath ?? "";
  editAudioPath.value = c.localAudioPath ?? "";
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
    await $fetch("/api/cards", {
      method: "PATCH",
      body: {
        id,
        localVideoPath: editVideoPath.value.trim() === "" ? null : editVideoPath.value.trim(),
        localAudioPath: editAudioPath.value.trim() === "" ? null : editAudioPath.value.trim(),
      },
    });
    editingId.value = null;
    await refresh();
  } catch (err) {
    editError.value = extractErrorMessage(err, "Failed to update card.");
  } finally {
    editSaving.value = false;
  }
}

async function removeCard(id: number) {
  await $fetch("/api/cards", { method: "DELETE", body: { id } });
  await refresh();
}
</script>

<template>
  <main class="cards">
    <div class="header-row">
      <h1>Cards</h1>
      <NuxtLink to="/cards/new" class="add-link">Add card</NuxtLink>
    </div>
    <p class="hint">Flashcards built from looked-up anime songs.</p>

    <div v-if="pending" class="state">Loading...</div>
    <div v-else-if="error" class="state state-error">Couldn't load cards. Try refreshing.</div>
    <template v-else>
      <ul v-if="data?.cards.length" class="card-list">
        <li v-for="c in data.cards" :key="c.id" class="card-row">
          <div class="card-info">
            <span class="song-title">{{ c.songTitle }}</span>
            <span class="meta">{{ c.artistName }} - {{ c.animeTitleEnglish }} ({{ c.themeSlot }})</span>
            <div class="badges">
              <span v-for="badge in sourceBadges(c)" :key="badge" class="badge">{{ badge }}</span>
              <span v-if="!sourceBadges(c).length" class="badge badge-none">No source</span>
            </div>
          </div>

          <template v-if="editingId === c.id">
            <div class="edit-form">
              <input
                v-model="editVideoPath"
                type="text"
                placeholder="Local video path (blank to clear)"
                :disabled="editSaving"
                class="path-input"
              />
              <input
                v-model="editAudioPath"
                type="text"
                placeholder="Local audio path (blank to clear)"
                :disabled="editSaving"
                class="path-input"
              />
              <div class="edit-actions">
                <button type="button" class="save-btn" :disabled="editSaving" @click="saveEdit(c.id)">Save</button>
                <button type="button" class="cancel-btn" :disabled="editSaving" @click="cancelEdit">Cancel</button>
              </div>
              <p v-if="editError" class="edit-error">{{ editError }}</p>
            </div>
          </template>
          <div v-else class="card-actions">
            <button type="button" class="edit-btn" @click="startEdit(c)">Edit</button>
            <button type="button" class="remove-btn" @click="removeCard(c.id)">Delete</button>
          </div>
        </li>
      </ul>
      <p v-else class="state">No cards yet. <NuxtLink to="/cards/new">Add one</NuxtLink>.</p>
    </template>
  </main>
</template>

<style scoped>
.cards {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 800;
}

.add-link {
  flex: none;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 800;
  text-decoration: none;
}

.hint {
  margin: 0 0 24px;
  color: var(--muted);
}

.state {
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.state a {
  color: var(--accent);
}

.state-error {
  color: var(--fail);
  border-color: var(--fail);
}

.card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.song-title {
  font-weight: 700;
}

.meta {
  color: var(--muted);
  font-size: 14px;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.badge {
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  background: var(--accent-secondary);
  color: var(--accent-secondary-ink);
  font-size: 12px;
  font-weight: 700;
}

.badge-none {
  background: var(--fail);
  color: var(--fail-ink);
}

.card-actions {
  flex: none;
  display: flex;
  gap: 8px;
}

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

.path-input {
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

.edit-actions {
  display: flex;
  gap: 8px;
}

.edit-error {
  margin: 0;
  color: var(--fail);
  font-size: 13px;
}
</style>
