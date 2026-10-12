<script setup lang="ts">
import { parseNetworkMode } from "~/utils/networkMode";

const props = defineProps<{ enabled: boolean }>();
const { notifyChanged } = useNetworkMode();
const confirmed = ref(props.enabled);
const isSaving = ref(false);
const error = ref<string | null>(null);
watch(() => props.enabled, (enabled) => { confirmed.value = enabled; });

async function setEnabled(event: Event) {
  const input = event.target as HTMLInputElement;
  const enabled = input.checked;
  input.checked = confirmed.value;
  if (isSaving.value) return;
  error.value = null;
  isSaving.value = true;
  try {
    const result = parseNetworkMode(await $fetch<unknown>("/api/media-library/offline-mode", { method: "POST", body: { enabled } }));
    if (result === null) throw new Error("Invalid network mode response");
    confirmed.value = result;
    notifyChanged();
    window.location.reload();
  } catch (failure) {
    error.value = extractErrorMessage(failure, "Couldn't save Offline mode. Try again.");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="offline-mode-control">
    <label class="offline-mode-label">
      <input type="checkbox" :checked="confirmed" :disabled="isSaving" @change="setEnabled" />
      Offline mode
    </label>
    <p class="offline-mode-hint">
      Use saved metadata, local covers and clips, and complete cached clips without starting external requests.
      Online discovery, refreshes, new downloads, and update checks are unavailable. LAN Party traffic still works.
    </p>
    <p class="offline-mode-hint">
      Saving reloads this page and notifies tabs on this origin. Refresh or reopen other Party doors for an immediate
      browser change; visible doors otherwise check within five seconds. Requests already started may finish.
    </p>
    <p v-if="isSaving" role="status" class="offline-mode-hint">Saving...</p>
    <p v-if="error" role="alert" class="control-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.offline-mode-control {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.offline-mode-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.offline-mode-label input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.offline-mode-hint {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.control-error {
  margin: 0;
  color: var(--fail);
  font-size: 14px;
}
</style>
