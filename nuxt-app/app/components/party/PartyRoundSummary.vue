<script setup lang="ts">
import type { PartySummary } from "~/composables/usePartyDisplay";

const props = defineProps<{ summary: PartySummary; sample?: boolean }>();

const SONGS_SHOWN = 12;
const recentSongs = computed(() => [...props.summary.songs].reverse().slice(0, SONGS_SHOWN));
const earlier = computed(() => Math.max(0, props.summary.songs.length - SONGS_SHOWN));
</script>

<template>
  <section class="summary" :class="{ sample }" aria-labelledby="summary-title">
    <PartyLayoutFrame piece="summaryTitle">
      <header class="summary-head">
        <MascotKai pose="cheer" size="companion" />
        <h2 id="summary-title" class="kai-banner kai-banner-pass summary-title">Results</h2>
        <p class="summary-count">{{ summary.played }} of {{ summary.total }} songs played</p>
      </header>
    </PartyLayoutFrame>

    <PartyLayoutFrame piece="standings">
      <div class="panel standings">
        <h3 class="panel-title">Standings</h3>
        <ol v-if="summary.standings.length" class="standings-list">
          <li
            v-for="player in summary.standings"
            :key="player.name"
            class="standing"
            :class="{ first: player.rank === 1 && player.score > 0 }"
          >
            <span class="standing-rank">{{ player.rank }}</span>
            <span class="standing-name">{{ player.name }}</span>
            <span class="standing-score">{{ player.score }}</span>
          </li>
        </ol>
        <p v-else class="empty">No players this game.</p>
      </div>
    </PartyLayoutFrame>

    <PartyLayoutFrame piece="songList">
      <div class="panel songs">
        <h3 class="panel-title">Songs</h3>
        <ol v-if="recentSongs.length" class="songs-list">
          <li v-for="song in recentSongs" :key="song.number" class="song">
            <span class="song-number">{{ song.number }}</span>
            <span class="song-text">
              <span class="song-anime">{{ song.anime }}</span>
              <span class="song-title">{{ song.song }}</span>
            </span>
            <span class="song-scorers" :class="{ none: !song.scorers.length }">{{ song.scorers.length ? song.scorers.join(", ") : "Nobody" }}</span>
          </li>
        </ol>
        <p v-else class="empty">No songs played yet.</p>
        <p v-if="earlier" class="empty">and {{ earlier }} earlier</p>
      </div>
    </PartyLayoutFrame>
  </section>
</template>

<style scoped>
.summary {
  position: absolute;
  inset: 0;
  background: var(--bg);
  overflow: hidden;
  animation: summary-in 300ms ease-out;
}

/* Samples float over the game while arranging, so the backdrop stays clear. */
.summary.sample {
  background: transparent;
  pointer-events: none;
  animation: none;
}

.summary-head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.summary-title {
  margin: 0;
  font-size: clamp(28px, 4vw, 5.93vh);
}

.summary-count {
  margin: 0 0 0 auto;
  color: var(--muted);
  font-size: clamp(14px, 1.6vw, 2.22vh);
}


.standings {
  width: min(51.9vh, 38vw);
}

.songs {
  width: min(83.3vh, 56vw);
}

.panel {
  max-height: 72vh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: clamp(12px, 1.6vw, 2.22vh);
  border: 3px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
}

.panel-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(18px, 2vw, 2.96vh);
}

.standings-list,
.songs-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}

.standing {
  display: grid;
  grid-template-columns: 2.2em 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: clamp(16px, 2vw, 2.96vh);
}

.standing.first {
  background: var(--surface-sunken);
  font-weight: 700;
}

.standing-rank {
  font-family: var(--font-display);
  color: var(--muted);
}

.standing.first .standing-rank {
  color: var(--star);
}

.standing-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.standing-score {
  font-family: var(--font-display);
  color: var(--accent);
}

.song {
  display: grid;
  grid-template-columns: 2.2em minmax(0, 1fr) minmax(0, auto);
  align-items: center;
  gap: 10px;
  font-size: clamp(13px, 1.3vw, 1.85vh);
}

.song-number {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.song-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.song-anime,
.song-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-anime {
  font-weight: 700;
}

.song-title {
  color: var(--muted);
}

.song-scorers {
  max-width: 16em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--pass);
  font-weight: 700;
  text-align: right;
}

.song-scorers.none {
  color: var(--muted);
  font-weight: 400;
}

.empty {
  margin: 0;
  color: var(--muted);
}

@keyframes summary-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .summary {
    animation: none;
  }
}
</style>
