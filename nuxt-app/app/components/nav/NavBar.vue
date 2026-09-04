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
    <div class="nav-logo" aria-hidden="true">歌</div>

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
  border-right: 1px solid var(--border);
}

.nav-logo {
  flex: none;
  width: 40px;
  height: 40px;
  margin-bottom: 14px;
  border-radius: var(--radius);
  background: var(--accent);
  color: var(--accent-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 19px;
  line-height: 1;
}

.nav-links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
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
  /* Transparent rather than absent, so the active state's 1px border does
     not shift the item by 2px when it turns on. */
  border: 1px solid transparent;
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
}

/* Absolutely positioned so turning it on never reflows the rail, and so it
   survives the icon-only collapse below 820px unchanged. */
.update-dot {
  position: absolute;
  top: 8px;
  right: 10px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent-secondary);
  box-shadow: 0 0 6px var(--accent-secondary);
}

.nav-link.active {
  background: var(--surface-raised);
  border-color: var(--accent);
  color: var(--accent);
}

/* Icon-only rail below 820px (50h), matching the narrow mockup's 56px rail /
   34px icon buttons. --rail-width itself is redefined in main.css so this
   only needs to bring the rail's own internals in line with that width. */
@media (max-width: 820px) {
  .app-nav {
    padding: 14px 0;
    gap: 8px;
  }

  .nav-logo {
    width: 32px;
    height: 32px;
    margin-bottom: 8px;
    font-size: 15px;
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
}
</style>
