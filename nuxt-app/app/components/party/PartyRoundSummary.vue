<script setup lang="ts">
import type { PartySummary } from "~/composables/usePartyDisplay";

const props = defineProps<{ summary: PartySummary }>();

const SONGS_SHOWN = 12;
const recentSongs = computed(() => [...props.summary.songs].reverse().slice(0, SONGS_SHOWN));
const earlier = computed(() => Math.max(0, props.summary.songs.length - SONGS_SHOWN));
</script>

<template>
  <section class="summary" aria-labelledby="summary-title">
    <header class="summary-head">
      <MascotKai pose="cheer" size="companion" />
      <h2 id="summary-title" class="kai-banner kai-banner-pass summary-title">Results</h2>
      <p class="summary-count">{{ summary.played }} of {{ summary.total }} songs played</p>
    </header>

    <div class="summary-body">
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
    </div>
  </section>
</template>

<style scoped>
.summary {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 2vh, 24px);
  padding: clamp(16px, 3vw, 48px);
  background: var(--bg);
  overflow: hidden;
  animation: summary-in 300ms ease-out;
}

.summary-head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.summary-title {
  margin: 0;
  font-size: clamp(28px, 4vw, 64px);
}

.summary-count {
  margin: 0 0 0 auto;
  color: var(--muted);
  font-size: clamp(14px, 1.6vw, 24px);
}

.summary-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: clamp(12px, 2vw, 32px);
}

.panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: clamp(12px, 1.6vw, 24px);
  border: 3px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  overflow: hidden;
}

.panel-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(18px, 2vw, 32px);
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
  font-size: clamp(16px, 2vw, 32px);
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
  font-size: clamp(13px, 1.3vw, 20px);
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
