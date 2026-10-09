<script setup lang="ts">
import type { ReviewHeatmap } from "~/utils/monthHeatmap";

interface CardWithDetails {
  id: number;
  songTitle: string;
  artistName: string;
  createdAt: string;
}

interface ReviewTimelineEntry {
  date: string;
  totalReviews: number;
  passCount: number;
  passRate: number | null;
}

interface WeakestDeckEntry {
  type: "artist" | "anime";
  id: number;
  label: string;
  coverImageUrl: string | null;
  passRate: number;
  totalReviews: number;
}

interface HomeDashboard {
  due: { due: number; new: number };
  cardMaturity: { learning: number; mature: number };
  streakDays: number;
  recentReviews: { totalReviews: number; passRate: number | null };
  timeline: ReviewTimelineEntry[];
  heatmap: ReviewHeatmap;
  weakestDecks: WeakestDeckEntry[];
  recentCards: CardWithDetails[];
}

const { data, pending, error } = useFetch<HomeDashboard>("/api/home");
// Client-only: it lives in localStorage, so rendering it on the server would
// mismatch on hydration.
const { lastPlayed } = useLastPlayed();

const heroHeadline = computed(() => {
  const due = data.value?.due;
  if (!due || due.due === 0) return "All caught up! Nothing due right now.";
  const cardWord = due.due === 1 ? "card" : "cards";
  return `${due.due} ${cardWord} due, ${due.new} new`;
});

function formatPassRate(passRate: number | null): string {
  if (passRate === null) return "No reviews yet";
  return `${Math.round(passRate * 100)}%`;
}

const maxTimelineReviews = computed(() => {
  const entries = data.value?.timeline ?? [];
  return entries.reduce((max, entry) => Math.max(max, entry.totalReviews), 0);
});

function barHeightPercent(entry: ReviewTimelineEntry): number {
  const max = maxTimelineReviews.value;
  return max > 0 ? (entry.totalReviews / max) * 100 : 0;
}

function passRateTier(passRate: number): "pass" | "warning" | "fail" {
  if (passRate >= 0.7) return "pass";
  if (passRate >= 0.4) return "warning";
  return "fail";
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
</script>

<template>
  <main class="home">
    <header class="home-header">
      <h1>Home</h1>
      <div class="header-controls">
        <NavSearch />
        <NuxtLink to="/cards" class="add-card-btn">+ Add card</NuxtLink>
      </div>
    </header>

    <div class="home-body">
      <div v-if="pending" class="state">
        <MascotState pose="laptop"><ActivityStatus label="Loading your dashboard" /></MascotState>
      </div>
      <div v-else-if="error" class="state state-error">
        <MascotState pose="slump">Couldn't load your dashboard. Try refreshing.</MascotState>
      </div>
      <div v-else-if="data" class="dashboard-grid">
        <div class="hero-panel">
          <img
            class="hero-art"
            src="/mascot/kai-hero-528.webp"
            srcset="/mascot/kai-hero-528.webp 528w, /mascot/kai-hero-1056.webp 1056w"
            sizes="(max-width: 820px) 240px, 420px"
            width="1056"
            height="724"
            alt="Kai, the GAQ SRS mascot, pointing at you with her headphones on"
            decoding="async"
          />
          <div class="hero-text">
            <span class="hero-eyebrow">♪ Ready to go</span>
            <span class="hero-headline">{{ heroHeadline }}</span>
          </div>
          <div class="hero-actions">
            <NuxtLink to="/study" class="hero-cta-primary">Start session</NuxtLink>
            <NuxtLink to="/decks" class="hero-cta-outline">Pick a deck</NuxtLink>
          </div>
          <ClientOnly>
            <NuxtLink
              v-if="lastPlayed"
              :to="{ path: '/cards', query: { q: lastPlayed.songTitle } }"
              class="last-played"
            >
              <img :src="lastPlayed.image" alt="" class="last-played-thumb" />
              <span class="last-played-text">
                <span class="last-played-label">Last played</span>
                <span class="last-played-song">{{ lastPlayed.songTitle }}</span>
              </span>
            </NuxtLink>
          </ClientOnly>
        </div>
        <StatsActivityHeatmap :heatmap="data.heatmap" class="home-heatmap" />
        <div class="activity-panel">
          <div class="panel-header">
            <span class="panel-title">Last 30 days</span>
            <span class="panel-subtitle">
              {{ formatPassRate(data.recentReviews.passRate) }} pass · {{ data.recentReviews.totalReviews }} review{{
                data.recentReviews.totalReviews === 1 ? "" : "s"
              }}
            </span>
          </div>
          <p v-if="!data.timeline.length" class="state">No reviews yet.</p>
          <div v-else class="chart-plot">
            <div
              v-for="entry in data.timeline"
              :key="entry.date"
              class="chart-bar"
              :style="{ height: `${barHeightPercent(entry)}%` }"
              :title="`${entry.date} - ${entry.totalReviews} review${entry.totalReviews === 1 ? '' : 's'}`"
            />
          </div>
          <div class="maturity-row">
            <div class="maturity-stat">
              <span class="maturity-value" :class="{ 'maturity-value-streak': data.streakDays > 0 }">{{
                data.streakDays
              }}</span>
              <span class="maturity-label">day streak</span>
            </div>
            <div class="maturity-stat">
              <span class="maturity-value">{{ data.cardMaturity.learning }}</span>
              <span class="maturity-label">learning</span>
            </div>
            <div class="maturity-stat">
              <span class="maturity-value">{{ data.cardMaturity.mature }}</span>
              <span class="maturity-label">mature</span>
            </div>
          </div>
        </div>
        <div class="side-panel">
          <div class="panel-header">
            <span class="panel-title">Weakest decks</span>
            <NuxtLink to="/stats" class="see-all-link">See all</NuxtLink>
          </div>
          <p v-if="!data.weakestDecks.length" class="state state-compact">Not enough review history yet.</p>
          <div v-else class="weak-deck-list">
            <NuxtLink
              v-for="entry in data.weakestDecks"
              :key="`${entry.type}-${entry.id}`"
              :to="`/decks?type=${entry.type}&id=${entry.id}`"
              class="weak-deck-row"
            >
              <img v-if="entry.coverImageUrl" :src="entry.coverImageUrl" alt="" class="weak-deck-cover" />
              <span v-else class="weak-deck-cover weak-deck-cover-empty" />
              <span class="weak-deck-info">
                <span class="weak-deck-label">{{ entry.label }}</span>
                <span class="weak-deck-bar-track">
                  <span
                    class="weak-deck-bar-fill"
                    :class="`tier-${passRateTier(entry.passRate)}`"
                    :style="{ width: `${Math.round(entry.passRate * 100)}%` }"
                  />
                </span>
              </span>
              <span class="weak-deck-rate" :class="`tier-${passRateTier(entry.passRate)}`"
                >{{ Math.round(entry.passRate * 100) }}%</span
              >
            </NuxtLink>
          </div>

          <div class="recent-cards-block">
            <span class="recent-cards-label">Recently added</span>
            <p v-if="!data.recentCards.length" class="state state-compact">No cards yet.</p>
            <div v-for="c in data.recentCards" :key="c.id" class="recent-card-row">
              <span class="recent-card-song"
                >{{ c.songTitle }} <span class="recent-card-artist">· {{ c.artistName }}</span></span
              >
              <span class="recent-card-time">{{ formatRelativeTime(c.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Fills the content column, like /cards and /decks after 50c/50d. */
.home {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.home-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: var(--header-height);
  padding: 16px 28px;
  background: var(--surface-sunken);
  border-bottom: 1px solid var(--border);
  /* The relocated NavSearch's dropdown is position:absolute inside this
     header; keep it above the dashboard panels below, same guarantee
     default.vue's removed .app-topbar used to provide. */
  position: relative;
  z-index: var(--z-chrome);
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 400;
  line-height: 1;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.add-card-btn {
  flex: none;
  display: inline-block;
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.add-card-btn:hover,
.hero-cta-primary:hover {
  background: var(--accent-strong);
}

.hero-cta-outline:hover {
  background: color-mix(in srgb, var(--accent-secondary) 10%, transparent);
}

.home-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 28px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  grid-template-rows: auto 1fr;
  gap: 20px;
  align-content: start;
}

.hero-panel {
  grid-column: 1 / -1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 18px;
  min-height: 210px;
  padding: 26px 30px;
  border-radius: calc(var(--radius) + 8px);
  background: var(--surface);
  border: 1px solid var(--outline);
  box-shadow: var(--shadow-soft);
}

/* The hero illustration fills the panel's right side and fades into it on
   the left, so the text and buttons keep a plain ground. */
.hero-art {
  position: absolute;
  top: 0;
  right: 0;
  width: clamp(260px, 42%, 460px);
  height: 100%;
  object-fit: cover;
  object-position: 50% 30%;
  /* currentColor only supplies the mask's opacity */
  mask-image: linear-gradient(to right, transparent, currentColor 32%);
  pointer-events: none;
  user-select: none;
}

.hero-text {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

/* a sticker pill, like the sheet's "ANIME OP QUIZ" badge */
.hero-eyebrow {
  padding: 4px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--outline);
  background: var(--surface);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: var(--accent);
}

.hero-headline {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 400;
  line-height: 1.15;
}

.hero-actions {
  position: relative;
  flex: none;
  display: flex;
  gap: 10px;
}

.hero-cta-primary {
  display: inline-block;
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: 0 6px 18px var(--accent-glow);
}

.hero-cta-outline {
  display: inline-block;
  padding: 11px 22px;
  border-radius: var(--radius-pill);
  border: 2px solid var(--accent-secondary);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  white-space: nowrap;
}

.last-played {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: min(100%, 360px);
  padding: 5px 14px 5px 5px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-surface-panel);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  color: var(--text);
  text-decoration: none;
}

.last-played-thumb {
  flex: none;
  width: 52px;
  height: 30px;
  border-radius: var(--radius-pill);
  object-fit: cover;
}

.last-played-text {
  display: grid;
  min-width: 0;
}

.last-played-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.last-played-song {
  overflow: hidden;
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-heatmap {
  grid-column: 1 / -1;
}

.activity-panel {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  font-weight: 900;
  font-size: 15px;
}

.panel-subtitle {
  font-size: 12px;
  color: var(--faint);
  white-space: nowrap;
}

.chart-plot {
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 150px;
}

/* surface-raised bars all but vanished into the panel in both themes */
.chart-bar {
  flex: 1;
  min-height: 2px;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--accent) 35%, var(--surface)),
    color-mix(in srgb, var(--accent) 70%, var(--surface))
  );
  border-radius: 4px 4px 0 0;
}

.chart-bar:hover {
  background: var(--accent);
}

.maturity-row {
  display: flex;
  gap: 22px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.maturity-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.maturity-value {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 400;
  line-height: 1;
}

.maturity-value-streak {
  color: var(--pass);
}

.maturity-label {
  font-size: 12px;
  color: var(--muted);
}

.side-panel {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 22px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  overflow: hidden;
}

.see-all-link {
  font-size: 12px;
  color: var(--accent-secondary);
  text-decoration: none;
  white-space: nowrap;
}

.weak-deck-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.weak-deck-row {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
}

.weak-deck-cover {
  flex: none;
  width: 34px;
  height: 48px;
  border-radius: var(--radius-xs);
  background: var(--surface-raised);
  object-fit: cover;
}

.weak-deck-cover-empty {
  display: block;
}

.weak-deck-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.weak-deck-label {
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.weak-deck-bar-track {
  height: 5px;
  border-radius: var(--radius-pill);
  background: var(--border);
  overflow: hidden;
}

.weak-deck-bar-fill {
  display: block;
  height: 100%;
}

.weak-deck-bar-fill.tier-pass {
  background: var(--pass);
}

.weak-deck-bar-fill.tier-warning {
  background: var(--warning);
}

.weak-deck-bar-fill.tier-fail {
  background: var(--fail);
}

.weak-deck-rate {
  flex: none;
  font-size: 13px;
  font-weight: 700;
}

.weak-deck-rate.tier-pass {
  color: var(--pass);
}

.weak-deck-rate.tier-warning {
  color: var(--warning);
}

.weak-deck-rate.tier-fail {
  color: var(--fail);
}

.recent-cards-block {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-cards-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--faint);
}

.recent-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.recent-card-song {
  font-size: 14px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-card-artist {
  color: var(--faint);
}

.recent-card-time {
  flex: none;
  font-size: 12px;
  color: var(--faint);
}

.state-compact {
  padding: 0;
}

.state {
  padding: 24px 28px;
  color: var(--muted);
}

.state-error {
  color: var(--fail);
}

/* 50h: hero-panel already spans both columns (grid-column: 1 / -1), so
   collapsing to one column just stacks the stats card above weakest-decks
   in document order - no other change needed. Placed last so it wins the
   source-order tiebreak over the earlier same-specificity base rules. */
@media (max-width: 820px) {
  .home-header {
    flex-wrap: wrap;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
