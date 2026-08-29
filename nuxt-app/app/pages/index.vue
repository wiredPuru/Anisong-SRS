<script setup lang="ts">
interface HubLink {
  to: string;
  label: string;
  description: string;
}

const links: HubLink[] = [
  { to: "/study", label: "Study", description: "Run through your due cards." },
  { to: "/cards", label: "Cards", description: "Browse, add, and edit flashcards." },
  { to: "/decks", label: "Decks", description: "Group cards by artist, anime, or your own decks." },
  { to: "/stats", label: "Stats", description: "See your guess-rate history." },
  { to: "/settings", label: "Settings", description: "Configure your media library." },
];
</script>

<template>
  <main class="home">
    <h1>GAQ SRS</h1>
    <p class="hint">Spaced-repetition practice for anime openings, endings, titles, and artists.</p>

    <div class="hub-grid">
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="hub-card">
        <span class="hub-label">{{ link.label }}</span>
        <span class="hub-description">{{ link.description }}</span>
      </NuxtLink>
    </div>
  </main>
</template>

<style scoped>
.home {
  max-width: 640px;
  margin: 0 auto;
  padding: 48px 24px;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 800;
}

.hint {
  margin: 0 0 32px;
  color: var(--muted);
}

.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.hub-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  text-decoration: none;
  color: var(--text);
  transition: border-color 0.15s ease;
}

.hub-card:hover {
  border-color: var(--accent);
}

.hub-label {
  font-weight: 800;
  font-size: 18px;
}

.hub-description {
  color: var(--muted);
  font-size: 14px;
}
</style>
