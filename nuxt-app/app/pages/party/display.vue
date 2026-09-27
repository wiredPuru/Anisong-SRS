<script setup lang="ts">
definePageMeta({ layout: "party" });
useHead({ title: "GAQ Party" });

const { state, connected, connect, reportPosition } = usePartyDisplay();

// Browsers block audio until the page is clicked once, so the screen waits
// for that click before following the host at all.
const started = ref(false);

function start() {
  started.value = true;
  connect();
}
</script>

<template>
  <main class="display" :class="{ 'is-started': started }">
    <button v-if="!started" type="button" class="display-start" @click="start">
      <MascotKai pose="wave" size="hero" />
      <span class="kai-banner kai-banner-pass display-start-banner">Click to start</span>
      <span class="display-hint">Starting lets this screen play sound for the game.</span>
    </button>

    <template v-else-if="state?.item">
      <PartyDisplayPlayer
        :token="state.item.token"
        :kind="state.item.kind"
        :playing="state.playing"
        :start-at="state.startAt"
        :seek-to="state.seekTo"
        :seek-seq="state.seekSeq"
        @position="reportPosition"
      />
      <p class="display-count">{{ state.item.number }} / {{ state.item.total }}</p>
      <PartyRevealOverlay v-if="state.answer" :answer="state.answer" />
    </template>

    <div v-else class="display-waiting">
      <MascotKai pose="sleepy" size="hero" />
      <h1 class="kai-banner kai-banner-neutral">Waiting for the host</h1>
      <p class="display-hint">
        {{ connected ? "The game starts on this screen once the host begins." : "Connecting to the party server..." }}
      </p>
    </div>
  </main>
</template>

<style scoped>
.display {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

.display.is-started {
  height: 100vh;
}

.display-start,
.display-waiting {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 24px;
  text-align: center;
}

.display-start {
  border: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
}

.display-start-banner,
.display-waiting h1 {
  font-size: clamp(24px, 4vw, 56px);
}

.display-hint {
  margin: 0;
  color: var(--muted);
  font-size: clamp(14px, 1.6vw, 22px);
}

.display-count {
  position: absolute;
  top: clamp(12px, 2vh, 24px);
  right: clamp(12px, 2vw, 24px);
  margin: 0;
  padding: 6px 16px;
  border: 2px solid var(--outline);
  border-radius: var(--radius-pill);
  background: var(--glass-surface-panel);
  font-family: var(--font-display);
  font-size: clamp(14px, 1.4vw, 22px);
}
</style>
