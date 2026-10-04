<script setup lang="ts">
definePageMeta({ layout: "party" });
useHead({ title: "GAQ Party - Join" });

const { view, state, connected, notice, savedName, join, rename, buzz, buzzing } = usePartyPlayer();

const name = ref("");
const joinError = ref<string | null>(null);
const joining = ref(false);

watch(savedName, (value) => {
  if (!name.value) name.value = value;
}, { immediate: true });

async function submitJoin() {
  joining.value = true;
  joinError.value = await join(name.value);
  joining.value = false;
}

const renaming = ref(false);
const newName = ref("");
const renameError = ref<string | null>(null);

function startRename() {
  newName.value = state.value?.me?.name ?? "";
  renameError.value = null;
  renaming.value = true;
}

async function submitRename() {
  renameError.value = await rename(newName.value);
  if (!renameError.value) renaming.value = false;
}

type Stage = "waiting" | "revealed" | "mine" | "other" | "locked" | "ready" | "listen";

const stage = computed<Stage>(() => {
  const current = state.value;
  if (!current?.song) return "waiting";
  if (current.phase === "revealed") return "revealed";
  const { buzzer } = current;
  if (buzzer.answeringIsMe) return "mine";
  if (buzzer.answering) return "other";
  if (buzzer.lockedOut) return "locked";
  if (buzzer.canBuzz) return "ready";
  return "listen";
});
</script>

<template>
  <main class="play">
    <section v-if="view === 'checking'" class="play-card">
      <p class="play-note">Connecting...</p>
    </section>

    <section v-else-if="view === 'join'" class="play-card">
      <header class="play-header">
        <MascotKai pose="wave" size="companion" />
        <div>
          <h1 class="play-title">Join the party</h1>
          <p class="play-note">Enter your name to join.</p>
        </div>
      </header>
      <p v-if="notice" class="play-notice" role="status">{{ notice }}</p>
      <form class="play-form" @submit.prevent="submitJoin">
        <label class="play-field">
          <span>Your name</span>
          <input v-model="name" maxlength="24" autocomplete="nickname" required />
        </label>
        <p v-if="joinError" class="play-error" role="alert">{{ joinError }}</p>
        <button type="submit" class="play-btn" :disabled="joining || !name.trim()">
          {{ joining ? "Joining..." : "Join" }}
        </button>
      </form>
    </section>

    <section v-else class="play-card">
      <p v-if="!connected" class="play-pill" role="status">Reconnecting...</p>
      <header class="play-header">
        <MascotKai pose="clap" size="companion" />
        <div class="me">
          <p class="play-note">You're in!</p>
          <h1 class="play-title">{{ state?.me?.name ?? savedName }}</h1>
        </div>
        <div class="score">
          <strong>{{ state?.me?.score ?? 0 }}</strong>
          <span>points</span>
        </div>
      </header>

      <div class="progress">
        <p v-if="state?.song" class="song">Song {{ state.song.number }} of {{ state.song.total }}</p>
        <p v-if="stage === 'waiting'" class="play-note">Waiting for the host to start the game.</p>
        <p v-else-if="stage === 'listen'" class="play-note">
          {{ state?.buzzer.enabled ? "Listen and guess!" : "Listen and guess! Buzzers are off for now." }}
        </p>
        <p v-else-if="stage === 'other'" class="play-note"><strong>{{ state?.buzzer.answering }}</strong> is answering...</p>
        <p v-else-if="stage === 'locked'" class="play-note">Not this one. Wait for the next song.</p>
      </div>

      <button
        v-if="stage === 'ready'"
        type="button"
        class="buzz-btn"
        :disabled="buzzing"
        @click="buzz"
      >
        Buzz!
      </button>
      <div v-else-if="stage === 'mine'" class="buzz-mine" role="status">
        <strong>You buzzed!</strong>
        <span>Say your answer out loud.</span>
      </div>
      <div v-else-if="stage === 'revealed' && state?.answer" class="reveal" role="status">
        <p class="reveal-anime">{{ state.answer.anime }}</p>
        <p class="reveal-song">{{ state.answer.song }} - {{ state.answer.artist }}</p>
        <p class="reveal-winner">
          {{ state.buzzer.winner ? (state.buzzer.winner === state.me?.name ? "You got it!" : `${state.buzzer.winner} got it!`) : "Check the screen!" }}
        </p>
      </div>

      <form v-if="renaming" class="play-form" @submit.prevent="submitRename">
        <label class="play-field">
          <span>New name</span>
          <input v-model="newName" maxlength="24" autocomplete="nickname" required />
        </label>
        <p v-if="renameError" class="play-error" role="alert">{{ renameError }}</p>
        <div class="play-actions">
          <button type="submit" class="play-btn" :disabled="!newName.trim()">Save</button>
          <button type="button" class="play-btn play-btn-secondary" @click="renaming = false">Cancel</button>
        </div>
      </form>
      <button v-else type="button" class="link-btn" @click="startRename">Change name</button>

      <ol v-if="state && state.players.length > 1" class="standings" aria-label="Standings">
        <li v-for="player in state.players" :key="player.name" :class="{ mine: player.name === state.me?.name }">
          <span>{{ player.name }}</span>
          <strong>{{ player.score }}</strong>
        </li>
      </ol>
    </section>
  </main>
</template>

<style scoped>
.play {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.play-card {
  position: relative;
  width: min(440px, 100%);
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.play-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.me {
  flex: 1;
  min-width: 0;
}

.play-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--accent);
  overflow-wrap: anywhere;
}

.play-note {
  margin: 0;
  color: var(--muted);
}

.play-notice {
  margin: 0;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--accent-secondary);
  color: var(--text);
}

.play-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.play-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 700;
  font-size: 14px;
}

.play-field input {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 18px;
}

.play-error {
  margin: 0;
  color: var(--fail);
  font-weight: 700;
}

.play-actions {
  display: flex;
  gap: 10px;
}

.play-btn {
  padding: 12px 24px;
  border: 2px solid var(--accent);
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
}

.play-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.play-btn-secondary {
  border-color: var(--accent-secondary);
  background: transparent;
  color: var(--accent-secondary);
}

.link-btn {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-weight: 700;
  cursor: pointer;
}

.score {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
}

.score strong {
  font-family: var(--font-display);
  font-size: 34px;
  color: var(--text);
}

.progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
}

.song {
  margin: 0;
  font-weight: 700;
}

.buzz-btn {
  align-self: center;
  width: min(240px, 70vw);
  aspect-ratio: 1;
  border: 6px solid var(--outline);
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-display);
  font-size: 40px;
  box-shadow: 0 10px 0 var(--outline);
  cursor: pointer;
  touch-action: manipulation;
}

.buzz-btn:active:not(:disabled) {
  transform: translateY(6px);
  box-shadow: 0 4px 0 var(--outline);
}

.buzz-btn:disabled {
  opacity: 0.7;
}

.buzz-mine,
.reveal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px;
  border: 3px solid var(--accent);
  border-radius: var(--radius);
  text-align: center;
}

.buzz-mine strong {
  font-family: var(--font-display);
  font-size: 30px;
  color: var(--accent);
}

.reveal p {
  margin: 0;
}

.reveal-anime {
  font-family: var(--font-display);
  font-size: 22px;
}

.reveal-song {
  color: var(--muted);
}

.reveal-winner {
  font-weight: 700;
  color: var(--accent);
}

@media (prefers-reduced-motion: reduce) {
  .buzz-btn:active:not(:disabled) {
    transform: none;
  }
}

.play-pill {
  position: absolute;
  top: -12px;
  right: 16px;
  margin: 0;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  background: var(--fail);
  color: var(--bg);
  font-size: 12px;
  font-weight: 700;
}

.standings {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.standings li {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
}

.standings li.mine {
  background: var(--surface-sunken);
  font-weight: 700;
}
</style>
