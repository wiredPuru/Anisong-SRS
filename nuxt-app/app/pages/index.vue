<script setup lang="ts">
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
  weakestDecks: WeakestDeckEntry[];
  recentCards: CardWithDetails[];
}

const { data, pending, error } = useFetch<HomeDashboard>("/api/home");

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
      <div v-if="pending" class="state">Loading...</div>
      <div v-else-if="error" class="state state-error">Couldn't load your dashboard. Try refreshing.</div>
      <div v-else-if="data" class="dashboard-grid">
        <div class="hero-panel">
          <div class="hero-glow" />
          <div class="hero-text">
            <span class="hero-eyebrow">Ready to go</span>
            <span class="hero-headline">{{ heroHeadline }}</span>
          </div>
          <div class="hero-actions">
            <NuxtLink to="/study" class="hero-cta-primary">Start session</NuxtLink>
            <NuxtLink to="/decks" class="hero-cta-outline">Pick a deck</NuxtLink>
          </div>
        </div>
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
  align-items: center;
  gap: 20px;
  padding: 22px 26px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.hero-glow {
  position: absolute;
  right: -60px;
  top: -80px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent-glow), transparent 65%);
  pointer-events: none;
}

.hero-text {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.hero-eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: var(--accent);
}

.hero-headline {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 400;
  line-height: 1.15;
}

.hero-actions {
  position: relative;
  margin-left: auto;
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
}

.hero-cta-outline {
  display: inline-block;
  padding: 12px 22px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--accent-secondary);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  white-space: nowrap;
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

.chart-bar {
  flex: 1;
  min-height: 2px;
  background: var(--surface-raised);
  border-radius: 2px 2px 0 0;
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
  border-radius: 3px;
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
</style>
