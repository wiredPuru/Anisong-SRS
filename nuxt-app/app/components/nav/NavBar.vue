<script setup lang="ts">
interface NavLink {
  to: string;
  label: string;
  icon: string;
}

const links: NavLink[] = [
  { to: "/", label: "Home", icon: "◈" },
  { to: "/study", label: "Study", icon: "▶" },
  { to: "/cards", label: "Cards", icon: "▤" },
  { to: "/decks", label: "Decks", icon: "◫" },
  { to: "/stats", label: "Stats", icon: "◲" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

const route = useRoute();

const { status: updateStatus, check: checkForUpdate } = useUpdateCheck();
onMounted(() => checkForUpdate());

function isActive(to: string): boolean {
  if (to === "/") return route.path === "/";
  return route.path === to || route.path.startsWith(`${to}/`);
}
</script>

<template>
  <nav class="app-nav">
    <NuxtLink to="/" class="nav-logo" aria-label="GAQ SRS home">
      <MascotKai pose="giggle" size="small" />
    </NuxtLink>
    <div class="nav-links">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="nav-link"
        :class="{ active: isActive(link.to) }"
      >
        <span class="nav-icon" aria-hidden="true">{{ link.icon }}</span>
        <span class="nav-label">{{ link.label }}</span>
        <span
          v-if="link.to === '/settings' && updateStatus?.updateAvailable"
          class="update-dot"
          :title="`Update available - ${updateStatus.latest}`"
        />
      </NuxtLink>
    </div>
  </nav>
</template>

<style scoped>
.app-nav {
  position: sticky;
  top: 0;
  z-index: var(--z-chrome);
  flex: none;
  align-self: flex-start;
  height: 100vh;
  width: var(--rail-width);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 0;
  background: var(--surface-sunken);
  border-right: 2px solid var(--outline);
}

/* Kai's head as the rail's logo (84e), after the head on the sheet's
   "ANIME OP QUIZ" badge. */
.nav-logo {
  flex: none;
  display: block;
  margin-bottom: 6px;
  transition: transform 0.2s ease;
}

.nav-logo:hover {
  transform: rotate(-6deg) scale(1.06);
}

/* flex: 1 + min-height: 0 + overflow-y: auto, rather than plain flow, so a
   rail taller than the viewport scrolls its own links instead of overflowing
   into the page - which previously left the sticky rail almost no room to
   stay stuck before it released and scrolled away with the page. */
.nav-links {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  overflow-y: auto;
}

.nav-link {
  position: relative;
  width: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 10px 0;
  border-radius: var(--radius);
  /* Transparent rather than absent, so the active state's border does not
     shift the item when it turns on. */
  border: 2px solid transparent;
  color: var(--muted);
  font-family: var(--font-sans);
  text-decoration: none;
}

.nav-icon {
  font-size: 17px;
  line-height: 1;
}

.nav-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--text);
  background: var(--surface);
}

/* Absolutely positioned so turning it on never reflows the rail, and so it
   survives the icon-only collapse below 820px unchanged. */
.update-dot {
  position: absolute;
  top: 8px;
  right: 10px;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--accent-secondary);
  box-shadow: 0 0 6px var(--accent-secondary);
}

.nav-link.active {
  background: var(--surface);
  border-color: var(--outline);
  color: var(--accent);
  box-shadow: var(--shadow-soft);
}

/* Icon-only rail below 820px (50h), matching the narrow mockup's 56px rail /
   34px icon buttons. --rail-width itself is redefined in main.css so this
   only needs to bring the rail's own internals in line with that width. */
@media (max-width: 820px) {
  .app-nav {
    padding: 14px 0;
    gap: 8px;
  }

  .nav-link {
    width: 34px;
    height: 34px;
    padding: 0;
    justify-content: center;
  }

  .nav-label {
    display: none;
  }

  .nav-logo :deep(.mascot-kai) {
    height: 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-logo {
    transition: none;
  }
}
</style>
