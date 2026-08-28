<script setup lang="ts">
const { data, pending, error, refresh } = await useFetch("/api/media-library");

const newPath = ref("");
const addError = ref<string | null>(null);
const isAdding = ref(false);

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { statusMessage?: string } }).data;
    if (data?.statusMessage) return data.statusMessage;
  }
  return fallback;
}

async function addFolder() {
  const path = newPath.value.trim();
  if (!path) return;

  addError.value = null;
  isAdding.value = true;
  try {
    await $fetch("/api/media-library/folders", { method: "POST", body: { path } });
    newPath.value = "";
    await refresh();
  } catch (err) {
    addError.value = extractErrorMessage(err, "Failed to add folder.");
  } finally {
    isAdding.value = false;
  }
}

async function removeFolder(path: string) {
  await $fetch("/api/media-library/folders", { method: "DELETE", body: { path } });
  await refresh();
}
</script>

<template>
  <main class="settings">
    <h1>Media library</h1>
    <p class="hint">Folders the app will look in for local anime clips.</p>

    <div v-if="pending" class="state">Loading...</div>
    <div v-else-if="error" class="state state-error">Couldn't load settings. Try refreshing.</div>
    <template v-else>
      <ul v-if="data?.libraryPaths.length" class="folder-list">
        <li v-for="path in data.libraryPaths" :key="path" class="folder-row">
          <span class="path">{{ path }}</span>
          <button type="button" class="remove-btn" @click="removeFolder(path)">Remove</button>
        </li>
      </ul>
      <p v-else class="state">No folders configured yet.</p>
    </template>

    <form class="add-form" @submit.prevent="addFolder">
      <input
        v-model="newPath"
        type="text"
        placeholder="/path/to/anime/clips"
        :disabled="isAdding"
        class="path-input"
      />
      <button type="submit" class="add-btn" :disabled="isAdding">Add folder</button>
    </form>
    <p v-if="addError" class="add-error">{{ addError }}</p>
  </main>
</template>

<style scoped>
.settings {
  max-width: 640px;
  margin: 0 auto;
  padding: 48px 24px;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 800;
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

.state-error {
  color: var(--fail);
  border-color: var(--fail);
}

.folder-list {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.folder-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.path {
  font-family: var(--font-sans);
  word-break: break-all;
}

.remove-btn {
  flex: none;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--fail);
  background: transparent;
  color: var(--fail);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.add-form {
  margin-top: 24px;
  display: flex;
  gap: 10px;
}

.path-input {
  flex: 1;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.path-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: var(--shadow-accent);
}

.add-btn {
  flex: none;
  padding: 12px 22px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 800;
  cursor: pointer;
}

.add-btn:disabled,
.path-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.add-error {
  margin-top: 10px;
  color: var(--fail);
  font-size: 14px;
}
</style>
