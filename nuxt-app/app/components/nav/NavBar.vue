<script setup lang="ts">
interface NavLink {
  to: string;
  label: string;
}

const links: NavLink[] = [
  { to: "/", label: "Home" },
  { to: "/study", label: "Study" },
  { to: "/cards", label: "Cards" },
  { to: "/decks", label: "Decks" },
  { to: "/stats", label: "Stats" },
  { to: "/settings", label: "Settings" },
];

const route = useRoute();
const ambientMode = useAmbientMode();

function isActive(to: string): boolean {
  if (to === "/") return route.path === "/";
  return route.path === to || route.path.startsWith(`${to}/`);
}
</script>

<template>
  <nav class="app-nav" :class="{ ambient: ambientMode }">
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="nav-link"
      :class="{ active: isActive(link.to) }"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.app-nav {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 12px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.app-nav.ambient {
  background: color-mix(in srgb, var(--surface) 45%, transparent);
  border-bottom-color: color-mix(in srgb, var(--border) 45%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.nav-link {
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  color: var(--muted);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 14px;
  text-decoration: none;
}

.nav-link:hover {
  color: var(--text);
}

.nav-link.active {
  background: var(--accent);
  color: var(--accent-ink);
}
</style>
