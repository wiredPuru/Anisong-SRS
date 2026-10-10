<script setup lang="ts">
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const PLAYER_LIMIT = 20;

const newName = ref("");
const editingId = ref<number | null>(null);
const editName = ref("");
const confirmingReset = ref(false);
const kickingId = ref<number | null>(null);
const kickError = ref<string | null>(null);

async function kick(id: number) {
  kickError.value = null;
  try {
    await $fetch("/api/party/host/kick", { method: "POST", body: { id } });
  } catch {
    kickError.value = "Couldn't kick that player.";
  }
  kickingId.value = null;
}

const players = computed(() => props.state.scoreboard.players);
const teams = computed(() => props.state.scoreboard.teams);
const newTeam = ref("");

function addTeam() {
  const name = newTeam.value.trim();
  if (!name) return;
  emit("command", { type: "score", op: "teamAdd", name });
  newTeam.value = "";
}

function assign(playerId: number, value: string) {
  emit("command", { type: "score", op: "assign", id: playerId, teamId: value === "" ? null : Number(value) });
}
const full = computed(() => players.value.length >= PLAYER_LIMIT);

function addPlayer() {
  const name = newName.value.trim();
  if (!name || full.value) return;
  emit("command", { type: "score", op: "add", name });
  newName.value = "";
}

function startRename(id: number, name: string) {
  editingId.value = id;
  editName.value = name;
}

function saveRename() {
  const name = editName.value.trim();
  if (editingId.value !== null && name) emit("command", { type: "score", op: "rename", id: editingId.value, name });
  editingId.value = null;
}

function resetScores() {
  confirmingReset.value = false;
  emit("command", { type: "score", op: "reset" });
}
</script>

<template>
  <section class="scores" aria-labelledby="scores-title">
    <div class="scores-head">
      <h2 id="scores-title" class="scores-title">Scoreboard</h2>
      <label class="check">
        <input
          type="checkbox"
          :checked="state.scoreboard.visible"
          @change="emit('command', { type: 'score', op: 'show', visible: ($event.target as HTMLInputElement).checked })"
        />
        Show on screen
      </label>
    </div>

    <ul class="players">
      <li v-for="player in players" :key="player.id" class="player">
        <form v-if="editingId === player.id" class="rename" @submit.prevent="saveRename">
          <input v-model="editName" class="text" type="text" maxlength="24" aria-label="Player name" />
          <button type="submit" class="mini">Save</button>
        </form>
        <button v-else type="button" class="name" title="Rename" @click="startRename(player.id, player.name)">
          {{ player.name }}
          <span v-if="player.phone" class="phone" :class="{ online: player.connected }">
            <span class="dot" aria-hidden="true" />{{ player.connected ? "Phone" : "Phone, offline" }}
          </span>
        </button>
        <select
          v-if="teams.length"
          class="team-select"
          :value="player.teamId ?? ''"
          :aria-label="`Team for ${player.name}`"
          @change="assign(player.id, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">No team</option>
          <option v-for="team in teams" :key="team.id" :value="team.id">{{ team.name }}</option>
        </select>
        <span class="score">{{ player.score }}</span>
        <button type="button" class="step" :aria-label="`Take a point from ${player.name}`" @click="emit('command', { type: 'score', op: 'adjust', id: player.id, delta: -1 })">−</button>
        <button type="button" class="step plus" :aria-label="`Give ${player.name} a point`" @click="emit('command', { type: 'score', op: 'adjust', id: player.id, delta: 1 })">+</button>
        <span v-if="kickingId === player.id" class="kick-confirm">
          <button type="button" class="mini" @click="kick(player.id)">Kick {{ player.name }}?</button>
          <button type="button" class="mini" @click="kickingId = null">Cancel</button>
        </span>
        <button v-else-if="player.phone" type="button" class="mini" @click="kickingId = player.id">Kick</button>
        <button type="button" class="remove" :aria-label="`Remove ${player.name}`" @click="emit('command', { type: 'score', op: 'remove', id: player.id })">✕</button>
      </li>
      <li v-if="!players.length" class="empty">No players yet.</li>
    </ul>
    <p v-if="kickError" class="empty" role="alert">{{ kickError }}</p>

    <form class="add" @submit.prevent="addPlayer">
      <input v-model="newName" class="text" type="text" maxlength="24" :placeholder="full ? 'Scoreboard is full' : 'Player or team name'" :disabled="full" />
      <button type="submit" class="mini" :disabled="!newName.trim() || full">Add</button>
    </form>

    <div class="teams">
      <p class="teams-label">Teams: members keep their own scores, and the screen shows each team's total.</p>
      <ul v-if="teams.length" class="team-list">
        <li v-for="team in teams" :key="team.id" class="team-chip">
          {{ team.name }}
          <button type="button" class="remove" :aria-label="`Remove team ${team.name}`" @click="emit('command', { type: 'score', op: 'teamRemove', id: team.id })">✕</button>
        </li>
      </ul>
      <form class="add" @submit.prevent="addTeam">
        <input v-model="newTeam" class="text" type="text" maxlength="24" placeholder="New team name" />
        <button type="submit" class="mini" :disabled="!newTeam.trim()">Add team</button>
      </form>
    </div>

    <div v-if="players.length" class="reset">
      <template v-if="confirmingReset">
        <span>Set every score to 0?</span>
        <button type="button" class="link danger" @click="resetScores">Reset scores</button>
        <button type="button" class="link" @click="confirmingReset = false">Cancel</button>
      </template>
      <button v-else type="button" class="link" @click="confirmingReset = true">Reset scores</button>
    </div>
  </section>
</template>

<style scoped>
.scores {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scores-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.scores-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
}

.players {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.player {
  /* Flex, not a fixed grid: a row holds up to seven controls (team, kick,
     its confirm) and a grid with fewer columns wrapped the extras. */
  display: flex;
  align-items: center;
  gap: 6px;
}

.player .step {
  width: 44px;
  flex: none;
}

.player .rename {
  flex: 1;
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: none;
  background: none;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.score {
  min-width: 2ch;
  font-family: var(--font-display);
  font-size: 20px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.step {
  height: 44px;
  border: 2px solid var(--accent-secondary);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--accent-secondary);
  font-size: 22px;
  font-weight: 700;
  cursor: pointer;
}

.step.plus {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.kick-confirm {
  display: inline-flex;
  gap: 4px;
}

.remove {
  border: none;
  background: none;
  color: var(--faint);
  font-size: 14px;
  cursor: pointer;
}

.empty {
  color: var(--muted);
  font-size: 14px;
}

.add,
.rename {
  display: flex;
  gap: 8px;
}

.rename {
  min-width: 0;
}

.text {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.mini {
  padding: 6px 14px;
  border: 2px solid var(--accent);
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.mini:disabled {
  opacity: 0.5;
  cursor: default;
}

.reset {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.link {
  border: none;
  background: none;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.link.danger {
  color: var(--fail);
}
.phone {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  vertical-align: middle;
}

.phone .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--faint);
}

.phone.online {
  color: var(--pass);
  border-color: var(--pass);
}

.phone.online .dot {
  background: var(--pass);
}
.teams {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.teams-label {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.team-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.team-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px 2px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  font-size: 13px;
  font-weight: 700;
}

.team-select {
  max-width: 110px;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font: inherit;
  font-size: 13px;
}
</style>
