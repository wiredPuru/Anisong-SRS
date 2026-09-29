<script setup lang="ts">
defineProps<{ displayUrl: string; controlUrls: string[]; isLoopback: boolean }>();
const emit = defineEmits<{ logout: []; sessionLost: [] }>();

const { state, connected, sessionLost, commandError, send } = usePartyHost();
const lastLoad = ref<{ loaded: number; skipped: number; total: number } | null>(null);
const hasGame = computed(() => Boolean(state.value && state.value.index >= 0 && state.value.queue.length));

watch(sessionLost, (lost) => {
  if (lost) emit("sessionLost");
});

const helpOpen = ref(false);
usePartyHotkeys(state, send, () => {
  helpOpen.value = !helpOpen.value;
});
</script>

<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <MascotKai pose="clap" size="small" />
      <h1 class="dashboard-title">GAQ Party</h1>
      <span class="dashboard-spacer" />
      <button type="button" class="link-btn" @click="helpOpen = true">Shortcuts (?)</button>
      <button type="button" class="link-btn" @click="emit('logout')">Log out</button>
    </header>

    <div class="dashboard-grid">
      <div class="main-column">
        <section class="panel" aria-label="Now playing">
          <p v-if="!connected && !state" class="panel-note">Connecting to the party server...</p>
          <template v-else-if="hasGame && state">
            <PartyNowPlaying :state="state" @command="send" />
            <p v-if="lastLoad?.skipped" class="panel-hint">
              {{ lastLoad.skipped }} song{{ lastLoad.skipped === 1 ? " was" : "s were" }} skipped with no playable clip.
            </p>
          </template>
          <p v-else class="panel-note">No game yet. Build one with New game.</p>
          <p v-if="commandError" class="panel-error" role="alert">{{ commandError }}</p>
        </section>

        <section v-if="state" class="panel">
          <PartyLightningPanel :state="state" @command="send" />
        </section>

        <section v-if="state" class="panel">
          <PartyEffectsPanel :state="state" @command="send" />
        </section>

        <section v-if="hasGame && state" class="panel">
          <PartyQueueList :state="state" @jump="send({ type: 'jump', index: $event })" @command="send" />
        </section>
      </div>

      <div class="side-column">
        <section class="panel">
          <PartyQueueBuilder :game-running="hasGame" @loaded="lastLoad = $event" />
        </section>

        <section v-if="state" class="panel">
          <PartyShowPanel :state="state" @command="send" />
        </section>

        <section v-if="state" class="panel">
          <PartyJoinPanel :state="state" @command="send" />
        </section>

        <section v-if="state" class="panel">
          <PartyScoreboardPanel :state="state" @command="send" />
        </section>

        <details class="panel connect">
          <summary>Connect a display or phone</summary>
          <dl class="links">
            <dt>Display screen (open it on the computer running GAQ Party)</dt>
            <dd><code>{{ displayUrl }}</code></dd>
            <dt>Host panel from a phone or laptop</dt>
            <dd v-for="url in controlUrls" :key="url"><code>{{ url }}</code></dd>
          </dl>
          <p v-if="isLoopback" class="panel-hint">
            Forgot the password later? Log out, then choose "Set a new password" on this computer.
          </p>
        </details>
      </div>
    </div>

    <PartyHotkeyHelp v-if="helpOpen" @close="helpOpen = false" />
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--accent);
}

.dashboard-spacer {
  flex: 1;
}

.link-btn {
  border: none;
  background: none;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.main-column,
.side-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  padding: 20px;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.panel-note,
.panel-hint,
.panel-error {
  margin: 0;
  color: var(--muted);
}

.panel-error {
  margin-top: 12px;
  color: var(--fail);
  font-weight: 700;
}

.panel-hint {
  margin-top: 12px;
  font-size: 13px;
  color: var(--faint);
}

.connect summary {
  font-weight: 700;
  cursor: pointer;
}

.links {
  margin: 12px 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.links dt {
  font-weight: 700;
  font-size: 13px;
}

.links dt:not(:first-child) {
  margin-top: 8px;
}

.links dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.links code {
  font-size: 13px;
  color: var(--accent-secondary);
}

@media (max-width: 820px) {
  .dashboard-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
