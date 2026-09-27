<script setup lang="ts">
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const TIMER_PRESETS = [10, 15, 20, 30];
const TICK_MS = 250;

const customSeconds = ref(45);
const autoReveal = ref(true);
const bannerText = ref("");
const music = ref<{ folder: string; tracks: string[] } | null>(null);

const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(async () => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, TICK_MS);
  await loadMusic();
});
onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker);
});

const hasGame = computed(() => props.state.index >= 0 && props.state.queue.length > 0);
const timerLeft = computed(() =>
  props.state.timer ? Math.max(0, Math.ceil((props.state.timer.endsAt - now.value) / 1000)) : null,
);

function startTimer(seconds: number) {
  emit("command", { type: "timer", seconds, autoReveal: autoReveal.value });
}

function showBanner() {
  const text = bannerText.value.trim();
  if (text) emit("command", { type: "banner", text });
}

async function loadMusic() {
  try {
    music.value = await $fetch("/api/party/host/music");
  } catch {
    music.value = null;
  }
}

function setMusic(patch: { enabled?: boolean; volume?: number }) {
  emit("command", { type: "music", ...props.state.music, ...patch });
}
</script>

<template>
  <section class="show" aria-labelledby="show-title">
    <h2 id="show-title" class="show-title">Show</h2>

    <div class="show-block">
      <p class="block-label">
        Timer
        <span v-if="timerLeft !== null" class="live">{{ timerLeft > 0 ? `${timerLeft}s left` : "Time's up" }}</span>
      </p>
      <div class="row">
        <button v-for="seconds in TIMER_PRESETS" :key="seconds" type="button" class="pill" :disabled="!hasGame" @click="startTimer(seconds)">
          {{ seconds }}s
        </button>
        <input v-model.number="customSeconds" class="num" type="number" min="3" max="120" aria-label="Custom seconds" />
        <button type="button" class="pill" :disabled="!hasGame" @click="startTimer(customSeconds)">Start</button>
        <button v-if="state.timer" type="button" class="pill" @click="emit('command', { type: 'timerStop' })">Stop</button>
      </div>
      <label class="check">
        <input v-model="autoReveal" type="checkbox" />
        Reveal the answer when time runs out
      </label>
    </div>

    <div class="show-block">
      <p class="block-label">Banner</p>
      <form class="row" @submit.prevent="showBanner">
        <input v-model="bannerText" class="text" type="text" maxlength="60" placeholder="Round 2: Endings only" />
        <button type="submit" class="pill" :disabled="!bannerText.trim()">Show</button>
        <button v-if="state.banner" type="button" class="pill" @click="emit('command', { type: 'banner', text: null })">Clear</button>
      </form>
    </div>

    <div class="show-block">
      <p class="block-label">Lobby music</p>
      <div class="row">
        <label class="check">
          <input type="checkbox" :checked="state.music.enabled" @change="setMusic({ enabled: ($event.target as HTMLInputElement).checked })" />
          Play between songs
        </label>
        <input
          class="volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          aria-label="Music volume"
          :value="state.music.volume"
          @change="setMusic({ volume: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <p v-if="music" class="note">
        {{ music.tracks.length }} track{{ music.tracks.length === 1 ? "" : "s" }} in
        <code>{{ music.folder }}</code>
        <button type="button" class="link" @click="loadMusic">Refresh</button>
      </p>
    </div>
  </section>
</template>

<style scoped>
.show {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.show-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.show-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block-label {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
}

.live {
  padding: 1px 10px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 12px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pill {
  padding: 6px 14px;
  border: 2px solid var(--accent-secondary);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.pill:disabled {
  opacity: 0.5;
  cursor: default;
}

.num,
.text {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.num {
  width: 64px;
}

.text {
  flex: 1;
  min-width: 160px;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.volume {
  flex: 1;
  min-width: 120px;
  accent-color: var(--accent);
}

.note {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.note code {
  color: var(--accent-secondary);
}

.link {
  border: none;
  background: none;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
</style>
