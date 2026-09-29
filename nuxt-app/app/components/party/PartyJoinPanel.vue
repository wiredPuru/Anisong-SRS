<script setup lang="ts">
import type { PartyJoinInfo } from "~/composables/usePartyDisplay";
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const info = ref<PartyJoinInfo | null>(null);
const error = ref<string | null>(null);
const renewing = ref(false);

onMounted(async () => {
  try {
    info.value = await $fetch<PartyJoinInfo>("/api/party/host/join-info");
  } catch (err) {
    error.value = extractErrorMessage(err, "Could not load the room code.");
  }
});

// Players already in keep their seats; only new joins need the new code.
async function newCode() {
  renewing.value = true;
  error.value = null;
  try {
    info.value = await $fetch<PartyJoinInfo>("/api/party/host/room-code", { method: "POST" });
  } catch (err) {
    error.value = extractErrorMessage(err, "Could not make a new code.");
  } finally {
    renewing.value = false;
  }
}

const shortUrl = (url: string) => url.replace(/^https?:\/\//, "");
</script>

<template>
  <section class="join" aria-labelledby="join-title">
    <h2 id="join-title" class="join-title">Players join at</h2>
    <template v-if="info">
      <ul v-if="info.urls.length" class="urls">
        <li v-for="url in info.urls" :key="url"><code>{{ shortUrl(url) }}</code></li>
      </ul>
      <p v-else class="hint">No network address found. Players need to be on the same network as this computer.</p>
      <div class="code-row">
        <span class="code-label">Room code</span>
        <strong class="code">{{ info.code }}</strong>
        <button type="button" class="mini" :disabled="renewing" @click="newCode">New code</button>
      </div>
      <label class="check">
        <input
          type="checkbox"
          :checked="state.joinInfoVisible"
          @change="emit('command', { type: 'joinInfo', visible: ($event.target as HTMLInputElement).checked })"
        />
        Show on screen during a game
      </label>
    </template>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.join {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.join-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.urls {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.urls code {
  font-size: 15px;
  font-weight: 700;
}

.code-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.code-label {
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}

.code {
  font-family: var(--font-display);
  font-size: 26px;
  letter-spacing: 0.2em;
  color: var(--accent);
}

.mini {
  margin-left: auto;
  padding: 4px 14px;
  border: 1px solid var(--accent-secondary);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.mini:disabled {
  opacity: 0.6;
  cursor: default;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.error {
  margin: 0;
  color: var(--fail);
  font-weight: 700;
}
</style>
