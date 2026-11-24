<script setup lang="ts">
import { PALETTE_SHORTCUT_LABEL, type PartyPaletteCommand } from "~/utils/partyPalette";
const props = defineProps<{ displayUrl: string; controlUrls: string[]; playerUrls: string[]; isLoopback: boolean }>();
// The display door only listens on the machine running GAQ Party.
const displayTitle = computed(() =>
  props.isLoopback ? "Open the display screen in a new tab" : "Opens only on the computer running GAQ Party",
);
const emit = defineEmits<{ logout: []; sessionLost: [] }>();

const { state, connected, sessionLost, commandError, send } = usePartyHost();
const { endlessSource } = usePartyNewGame();

// While endless runs, a source or filter change from any panel applies at once,
// with the difficulty and toggles it is already running on.
watch(() => JSON.stringify(endlessSource.value), () => {
  const running = state.value?.endless;
  const { scope, filters } = endlessSource.value;
  if (!running || (!scope && !running.outsideLibrary)) return;
  const { catalogNote: _note, ...config } = running;
  send({ type: "endless", config: { ...config, scope: scope ?? { type: "all" }, filtered: Boolean(filters) }, ...(filters ? { filters } : {}) });
});
const lastLoad = ref<{ loaded: number; skipped: number; total: number } | null>(null);
const hasGame = computed(() => Boolean(state.value && state.value.index >= 0 && state.value.queue.length));

watch(sessionLost, (lost) => {
  if (lost) emit("sessionLost");
});

// Settings shows one group at a time; 1-4 open it on that group.
const TABS = [
  { id: "round", label: "Round" },
  { id: "screen", label: "Screen" },
  { id: "players", label: "Players" },
  { id: "game", label: "New game" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const tab = ref<TabId>("round");
const settingsOpen = ref(false);
// With no game, New game sits in the middle column rather than in Settings.
const visibleTabs = computed(() => (hasGame.value ? TABS : TABS.filter((item) => item.id !== "game")));
watch(hasGame, (running) => {
  if (!running && tab.value === "game") tab.value = "round";
});

/** Open Settings on a tab, or point at the inline New game when no game runs. */
function openTab(id: TabId) {
  if (id === "game" && !hasGame.value) {
    settingsOpen.value = false;
    void jumpTo({ id: "panel-new-game", target: "new-game", kind: "jump" });
    return;
  }
  tab.value = id;
  settingsOpen.value = true;
}

// Add songs starts open with no game, and folds away once one is running.
const addSongsOpen = ref(true);
watch(hasGame, (running, was) => {
  if (running !== was) addSongsOpen.value = !running;
}, { immediate: true });

// Unlike the app-wide Ambient preference, the host's glow starts on.
const AMBIENT_KEY = "gaqSrs:partyHostAmbient";
const ambientOn = ref(true);
onMounted(() => {
  try {
    ambientOn.value = localStorage.getItem(AMBIENT_KEY) !== "0";
  } catch {
    // Storage can be unavailable; the glow just stays on.
  }
});
function toggleAmbient() {
  ambientOn.value = !ambientOn.value;
  try {
    localStorage.setItem(AMBIENT_KEY, ambientOn.value ? "1" : "0");
  } catch {
    // The choice still holds until the page reloads.
  }
}

const columns = usePartyHostColumns();
const { gridRef: columnsGrid } = columns;

const helpOpen = ref(false);
const { actionContext } = usePartyHotkeys(
  state,
  send,
  () => {
    helpOpen.value = !helpOpen.value;
  },
  (index) => {
    const target = TABS[index];
    if (target) openTab(target.id);
  },
);

// Shift+P replaces the shortcuts list rather than opening under it.
const commandBar = usePartyCommandBar(() => {
  helpOpen.value = false;
});
const paletteLocal = computed(() => ({ ambientOn: ambientOn.value }));

const FLASH_MS = 1200;
const FIELD_SELECTOR = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not(:disabled), textarea:not(:disabled)";

async function jumpTo(command: Pick<PartyPaletteCommand, "id" | "target" | "kind" | "tab">) {
  if (command.tab && (command.tab !== "game" || hasGame.value)) {
    tab.value = command.tab;
    settingsOpen.value = true;
  } else {
    settingsOpen.value = false;
  }
  if (command.target === "add-songs") addSongsOpen.value = true;
  await nextTick();
  const target = document.querySelector<HTMLElement>(`[data-palette-target="${command.target}"]`);
  // A panel that only shows during a game may not be on the page; the pick just closes.
  if (!target) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  if (!reduced) {
    target.classList.remove("palette-flash");
    void target.offsetWidth;
    target.classList.add("palette-flash");
    window.setTimeout(() => target.classList.remove("palette-flash"), FLASH_MS);
  }
  if (command.kind === "jump") target.querySelector<HTMLElement>(FIELD_SELECTOR)?.focus({ preventScroll: true });
}

function runCommand(command: PartyPaletteCommand) {
  if (command.local === "help") helpOpen.value = true;
  else if (command.local === "ambient") toggleAmbient();
  else if (command.run && state.value) {
    const sent = command.run(state.value, actionContext());
    if (sent) send(sent);
  }
}

function onPick(command: PartyPaletteCommand) {
  commandBar.remember(command.id);
  commandBar.close();
  runCommand(command);
  if (command.target && command.kind !== "action") void jumpTo(command);
}

const moreOpen = ref(false);

/** From More options or a pinned control: a toggle just flips (the pop-up stays open), anything else closes the pop-up. */
function onMoreOptionsPick(command: PartyPaletteCommand) {
  if (command.kind !== "toggle") moreOpen.value = false;
  runCommand(command);
  if (command.kind === "jump") void jumpTo(command);
}
</script>

<template>
  <PartyHostAmbient v-if="ambientOn" :state="state" />
  <div class="dashboard" :class="{ ambient: ambientOn }">
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
      <a v-if="displayUrl" :href="displayUrl" target="_blank" rel="noopener" class="link-btn" :title="displayTitle">Display ↗</a>
      <a
        v-if="playerUrls[0]"
        :href="playerUrls[0]"
        target="_blank"
        rel="noopener"
        class="link-btn"
        :title="`Where players join: ${playerUrls[0]}`"
      >Player page ↗</a>
      <button type="button" class="link-btn" :aria-pressed="ambientOn" @click="toggleAmbient">Ambient: {{ ambientOn ? "on" : "off" }}</button>
      <button type="button" class="link-btn" @click="commandBar.show()">Commands ({{ PALETTE_SHORTCUT_LABEL }})</button>
      <button type="button" class="link-btn" @click="helpOpen = true">Shortcuts (?)</button>
      <button type="button" class="link-btn" @click="emit('logout')">Log out</button>
    </header>

    <div ref="columnsGrid" class="dashboard-grid" :class="{ resizing: columns.dragging.value !== null }" :style="columns.columnVars.value">
      <div class="column queue-column">
        <section v-if="state?.endless" class="panel order-queue">
          <PartyEndlessFilters :endless="state.endless" />
        </section>
        <section v-if="state" class="panel order-queue" data-palette-target="add-songs">
          <button type="button" class="panel-toggle" :aria-expanded="addSongsOpen" @click="addSongsOpen = !addSongsOpen">
            <h2 class="panel-title">Add songs</h2>
            <span class="toggle-mark" aria-hidden="true">{{ addSongsOpen ? "−" : "+" }}</span>
          </button>
          <div v-show="addSongsOpen" class="add-songs-body">
            <PartyQueueSearch :state="state" />
          </div>
        </section>
        <section v-if="hasGame && state" class="panel queue-panel order-queue" data-palette-target="queue">
          <PartyQueueList :state="state" @jump="send({ type: 'jump', index: $event })" @command="send" />
        </section>
        <p v-else-if="state" class="panel panel-note queue-panel order-queue">The queue shows here once a game starts.</p>
      </div>

      <div
        class="col-divider"
        :class="{ dragging: columns.dragging.value === 0 }"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the left and middle columns"
        title="Drag to resize, double-click for equal columns"
        @pointerdown="columns.onPointerDown(0, $event)"
        @dblclick="columns.reset()"
      />

      <div class="column main-column">
        <section v-if="state && hasGame" class="panel info-panel order-info" aria-label="Current song">
          <PartySongInfo :state="state" />
        </section>
        <!-- With no game the middle column is where one starts; during a game New game lives in Settings. -->
        <template v-else>
          <section class="panel order-info" data-palette-target="new-game">
            <PartyQueueBuilder :game-running="hasGame" @loaded="lastLoad = $event" />
          </section>
          <section v-if="state" class="panel order-info" data-palette-target="endless"><PartyEndlessPanel :state="state" :source="endlessSource" @command="send" /></section>
        </template>

        <section class="panel pinned-panel order-transport">
          <PartyPinnedControls :state="state" :local="paletteLocal" @pick="onMoreOptionsPick" @more="moreOpen = true" />
        </section>

        <section class="panel transport-panel order-transport" aria-label="Now playing" data-palette-target="now-playing">
          <p v-if="!connected && !state" class="panel-note">Connecting to the party server...</p>
          <template v-else-if="hasGame && state">
            <PartyNowPlaying :state="state" @command="send" />
            <p v-if="lastLoad?.skipped" class="panel-hint">
              {{ lastLoad.skipped }} song{{ lastLoad.skipped === 1 ? " was" : "s were" }} skipped with no playable clip.
            </p>
          </template>
          <p v-else class="panel-note">No game yet. Build one under New game above.</p>
          <p v-if="commandError" class="panel-error" role="alert">{{ commandError }}</p>
        </section>
      </div>

      <div
        class="col-divider"
        :class="{ dragging: columns.dragging.value === 1 }"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the middle and right columns"
        title="Drag to resize, double-click for equal columns"
        @pointerdown="columns.onPointerDown(1, $event)"
        @dblclick="columns.reset()"
      />

      <div class="column side-column">
        <section v-if="state" class="panel grow order-score">
          <PartyRoundJudge :state="state" @command="send" />
          <PartyScoreboardPanel :state="state" data-palette-target="scoreboard" @command="send" />
          <PartyRulesPanel :state="state" data-palette-target="rules" @command="send" />
        </section>
      </div>
    </div>

    <PartyHostDialog :open="settingsOpen" title="Settings" wide @close="settingsOpen = false">
      <div class="tabs" role="tablist" aria-label="Game settings">
        <button
          v-for="item in visibleTabs"
          :key="item.id"
          type="button"
          role="tab"
          class="tab"
          :class="{ on: tab === item.id }"
          :aria-selected="tab === item.id"
          @click="tab = item.id"
        >
          {{ item.label }} <kbd class="tab-key">{{ TABS.indexOf(item) + 1 }}</kbd>
        </button>
      </div>

      <template v-if="tab === 'round' && state">
        <section class="panel" data-palette-target="lightning"><PartyLightningPanel :state="state" @command="send" /></section>
        <section class="panel" data-palette-target="live"><PartyLivePanel :state="state" @command="send" /></section>
      </template>
      <template v-else-if="tab === 'screen' && state">
        <section class="panel" data-palette-target="effects"><PartyEffectsPanel :state="state" @command="send" /></section>
        <section class="panel" data-palette-target="reveal-fields"><PartyRevealPanel :state="state" @command="send" /></section>
        <section class="panel" data-palette-target="show"><PartyShowPanel :state="state" @command="send" /></section>
      </template>
      <template v-else-if="tab === 'players' && state">
        <section class="panel" data-palette-target="join"><PartyJoinPanel :state="state" @command="send" /></section>
        <section class="panel connect" data-palette-target="connect">
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
      <template v-if="hasGame">
        <!-- Kept mounted so a half-built game survives a look at another tab. -->
        <section v-show="tab === 'game'" class="panel" data-palette-target="new-game">
          <PartyQueueBuilder :game-running="hasGame" @loaded="lastLoad = $event" />
        </section>
        <section v-if="tab === 'game' && state" class="panel" data-palette-target="endless"><PartyEndlessPanel :state="state" :source="endlessSource" @command="send" /></section>
      </template>
    </PartyHostDialog>

    <PartyMoreOptions :open="moreOpen" :state="state" :local="paletteLocal" @pick="onMoreOptionsPick" @close="moreOpen = false" />
    <PartyHotkeyHelp v-if="helpOpen" @close="helpOpen = false" />
    <PartyCommandBar
      v-if="commandBar.open.value"
      :state="state"
      :local="paletteLocal"
      :recent="commandBar.recent.value"
      @pick="onPick"
      @close="commandBar.close()"
    />
  </div>
</template>

<style scoped>
.tab-key {
  margin-left: 4px;
  padding: 0 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 11px;
}

/* One screen, no page scroll: each column scrolls on its own if it must,
   with its scrollbar hidden. Below 1100px it stacks into one long page. */
.dashboard {
  position: relative;
  z-index: 1;
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
  text-decoration: none;
}

.dashboard-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  /* The divider tracks are the gaps; their 16px matches HOST_DIVIDER_PX. */
  grid-template-columns:
    minmax(0, var(--col-a, 1fr)) 16px
    minmax(0, var(--col-b, 1fr)) 16px
    minmax(0, var(--col-c, 1fr));
}

.dashboard-grid.resizing {
  cursor: col-resize;
  user-select: none;
}

/* Faint at rest so touch screens, which never hover, can still find it. */
.col-divider {
  position: relative;
  cursor: col-resize;
  touch-action: none;
}

.col-divider::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 6px;
  width: 4px;
  border-radius: var(--radius-pill);
  background: var(--border);
  opacity: 0.5;
  transition: background 0.15s, opacity 0.15s;
}

.col-divider:hover::after,
.col-divider.dragging::after {
  background: var(--accent);
  opacity: 1;
}

.column {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  scrollbar-width: none;
}

.column::-webkit-scrollbar {
  display: none;
}

/* The queue and the song info fill what is left of their columns and scroll
   inside their own panels, so the controls below the song info stay in view;
   on a short window the column itself scrolls instead. */
.panel.info-panel {
  flex: 1 1 0;
  min-height: 220px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.panel.queue-panel {
  flex: 1 1 0;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel.transport-panel,
.panel.pinned-panel {
  flex: none;
}

.panel.pinned-panel {
  padding: 14px;
}

.panel-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.panel-toggle .panel-title {
  margin: 0;
}

.toggle-mark {
  font-size: 20px;
  font-weight: 700;
  color: var(--muted);
}

.add-songs-body {
  margin-top: 10px;
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
    /* vh is not zoomed, so the preview's height cap is scaled back down. */
    --preview-height: 16.25vh;
  }
}

@media (max-width: 1100px) {
  .dashboard {
    height: auto;
  }

  /* The columns dissolve into one list, ordered so a phone host reaches
     the transport first. */
  .dashboard-grid {
    display: flex;
    flex-direction: column;
  }

  .column {
    display: contents;
  }

  .col-divider {
    display: none;
  }

  .panel.queue-panel {
    flex: none;
    height: 460px;
  }

  .panel.info-panel {
    flex: none;
    overflow: visible;
  }

  .order-transport {
    order: 1;
  }

  .order-info {
    order: 2;
  }

  .order-score {
    order: 3;
  }

  .order-queue {
    order: 4;
  }


  .dashboard-header {
    flex-wrap: wrap;
  }
}
</style>

<style scoped>
.dashboard.ambient .panel {
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  backdrop-filter: blur(16px);
}
</style>
