<script setup lang="ts">
defineProps<{ displayUrl: string; controlUrls: string[]; isLoopback: boolean }>();
const emit = defineEmits<{ logout: []; sessionLost: [] }>();

const { state, connected, sessionLost, commandError, send } = usePartyHost();
const lastLoad = ref<{ loaded: number; skipped: number; total: number } | null>(null);
const hasGame = computed(() => Boolean(state.value && state.value.index >= 0 && state.value.queue.length));

watch(sessionLost, (lost) => {
  if (lost) emit("sessionLost");
});

// The settings column keeps one group open at a time, so the whole panel
// fits one screen instead of a long scroll.
const TABS = [
  { id: "round", label: "Round" },
  { id: "screen", label: "Screen" },
  { id: "players", label: "Players" },
  { id: "game", label: "New game" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const tab = ref<TabId>("game");
// Once a game is running, the round settings are what the host reaches for.
watch(hasGame, (running, was) => {
  if (running && !was && tab.value === "game") tab.value = "round";
}, { immediate: true });

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
      <span class="status-chip" :class="{ online: connected }">
        <span class="status-dot" aria-hidden="true" />{{ connected ? "Connected" : "Connecting..." }}
      </span>
      <span v-if="state?.scoreboard.players.length" class="status-chip">
        {{ state.scoreboard.players.length }} player{{ state.scoreboard.players.length === 1 ? "" : "s" }}
      </span>
      <span class="dashboard-spacer" />
      <button type="button" class="link-btn" @click="helpOpen = true">Shortcuts (?)</button>
      <button type="button" class="link-btn" @click="emit('logout')">Log out</button>
    </header>

    <div class="dashboard-grid">
      <div class="column queue-column">
        <section v-if="state" class="panel">
          <h2 class="panel-title">Add songs</h2>
          <PartyQueueSearch :state="state" />
        </section>
        <section v-if="hasGame && state" class="panel grow">
          <PartyQueueList :state="state" @jump="send({ type: 'jump', index: $event })" @command="send" />
        </section>
        <p v-else-if="state" class="panel panel-note">The queue shows here once a game starts.</p>
      </div>

      <div class="column main-column">
        <section class="panel" aria-label="Now playing">
          <p v-if="!connected && !state" class="panel-note">Connecting to the party server...</p>
          <template v-else-if="hasGame && state">
            <PartyNowPlaying :state="state" @command="send" />
            <p v-if="lastLoad?.skipped" class="panel-hint">
              {{ lastLoad.skipped }} song{{ lastLoad.skipped === 1 ? " was" : "s were" }} skipped with no playable clip.
            </p>
          </template>
          <p v-else class="panel-note">No game yet. Build one under New game.</p>
          <p v-if="commandError" class="panel-error" role="alert">{{ commandError }}</p>
        </section>

        <section v-if="state" class="panel grow">
          <PartyScoreboardPanel :state="state" @command="send" />
        </section>
      </div>

      <div class="column side-column">
        <div class="tabs" role="tablist" aria-label="Game settings">
          <button
            v-for="item in TABS"
            :key="item.id"
            type="button"
            role="tab"
            class="tab"
            :class="{ on: tab === item.id }"
            :aria-selected="tab === item.id"
            @click="tab = item.id"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="tab-body">
          <template v-if="tab === 'round' && state">
            <section class="panel"><PartyLightningPanel :state="state" @command="send" /></section>
            <section class="panel"><PartyStakePanel :state="state" @command="send" /></section>
            <section class="panel"><PartyLivePanel :state="state" @command="send" /></section>
            <section class="panel"><PartyEndlessPanel :state="state" @command="send" /></section>
          </template>
          <template v-else-if="tab === 'screen' && state">
            <section class="panel"><PartyEffectsPanel :state="state" @command="send" /></section>
            <section class="panel"><PartyRevealPanel :state="state" @command="send" /></section>
            <section class="panel"><PartyShowPanel :state="state" @command="send" /></section>
          </template>
          <template v-else-if="tab === 'players' && state">
            <section class="panel"><PartyJoinPanel :state="state" @command="send" /></section>
            <section class="panel connect">
              <h2 class="panel-title">Connect a display or phone</h2>
              <dl class="links">
                <dt>Display screen (open it on the computer running GAQ Party)</dt>
                <dd><code>{{ displayUrl }}</code></dd>
                <dt>Host panel from a phone or laptop</dt>
                <dd v-for="url in controlUrls" :key="url"><code>{{ url }}</code></dd>
              </dl>
              <p v-if="isLoopback" class="panel-hint">
                Forgot the password later? Log out, then choose "Set a new password" on this computer.
              </p>
            </section>
          </template>
          <!-- Kept mounted so a half-built game survives a look at another tab. -->
          <section v-show="tab === 'game'" class="panel">
            <PartyQueueBuilder :game-running="hasGame" @loaded="lastLoad = $event" />
          </section>
        </div>
      </div>
    </div>

    <PartyHotkeyHelp v-if="helpOpen" @close="helpOpen = false" />
  </div>
</template>

<style scoped>
/* One screen, no page scroll: each column scrolls on its own if it must,
   with its scrollbar hidden. Below 1100px it stacks into one long page. */
.dashboard {
  height: 100vh;
  padding: 16px 20px;
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
  font-size: 22px;
  color: var(--accent);
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-raised);
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--faint);
}

.status-chip.online .status-dot {
  background: var(--pass);
}

.dashboard-spacer {
  flex: 1;
}

.link-btn {
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 7px 14px;
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.dashboard-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr) minmax(340px, 440px);
  gap: 16px;
}

.column {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  scrollbar-width: none;
}

.column::-webkit-scrollbar,
.tab-body::-webkit-scrollbar {
  display: none;
}

.side-column {
  overflow: hidden;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-sunken);
  flex: none;
}

.tab {
  flex: 1;
  padding: 8px 6px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.tab.on {
  background: var(--accent);
  color: var(--accent-ink);
}

.tab-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  scrollbar-width: none;
}

.panel {
  flex: none;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.panel.grow {
  flex: 1 0 auto;
}

.panel-title {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-size: 18px;
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

.links {
  margin: 0;
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

/* A 4K screen at 100% scaling would otherwise render the panel at a third
   of the screen's height. */
@media (min-width: 3000px) and (min-height: 1800px) {
  .dashboard {
    zoom: 1.6;
    height: calc(100vh / 1.6);
  }
}

@media (max-width: 1400px) {
  .dashboard-grid {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
  }

  .queue-column {
    grid-column: 1;
    grid-row: 2;
  }

  .main-column {
    grid-column: 1;
    grid-row: 1;
  }

  .side-column {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
}

@media (max-width: 1100px) {
  .dashboard {
    height: auto;
  }

  .dashboard-grid {
    display: flex;
    flex-direction: column;
  }

  .column,
  .side-column,
  .tab-body {
    overflow: visible;
  }

  .dashboard-header {
    flex-wrap: wrap;
  }
}
</style>
