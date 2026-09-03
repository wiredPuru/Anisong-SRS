<script setup lang="ts">
const route = useRoute();

// Home only, matching the design reference: every other screen carries its
// own page-scoped search (Cards' unified search, Decks' per-tab filter) and
// the artboards show no global box on any of them. 50f moves this into the
// redesigned Home header; until then the strip is how Home carries it.
const showGlobalSearch = computed(() => route.path === "/");
</script>

<template>
  <div class="app-shell">
    <NavBar />
    <div class="app-content">
      <div v-if="showGlobalSearch" class="app-topbar">
        <NavSearch />
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  align-items: flex-start;
  min-height: 100vh;
}

/* min-width: 0 so the content column can shrink below its content's
   intrinsic width instead of pushing the rail off-screen.

   A full-height flex column as of 50b: .app-shell sets align-items:
   flex-start, so this column would otherwise be only as tall as its
   content, and a page that wants to fill the window (study's split panes,
   and every other Akiba Neon screen after it) would have nothing to
   measure against. A page opts in with flex: 1; pages that don't stay in
   normal flow exactly as before.

   height, not min-height: min-height let the column grow past the window,
   so "fill the window" resolved to "fill the content" and a page could
   never size anything against the viewport - /study's panes grew to their
   tallest child and ran the player off the bottom instead of fitting.
   A definite height makes the leftover space real, so /study's .side
   scrolls inside its pane (its overflow-y: auto never engaged before) and
   the player can cap its height. Taller pages are unaffected: overflow
   stays visible, so their content still extends the document and the
   window scrolls exactly as before. */
.app-content {
  flex: 1;
  min-width: 0;
  height: 100vh;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Below /study's own stacking breakpoint the split panes sit one above the
   other, and holding them both in one window leaves each too short to be
   worth showing (the player drops to about a third of its width). Scrolling
   is the better trade there, so the column goes back to growing. 50h is the
   real narrow-window pass. */
@media (max-width: 820px) {
  .app-content {
    height: auto;
    min-height: 100vh;
  }
}

/* Home only - see showGlobalSearch above.

   The search dropdown is absolutely positioned inside NavSearch, and used to
   sit above page content via .app-nav's z-index. The rail keeps that for
   itself now, so the strip needs its own stacking context or the dropdown
   renders underneath Home's own content. Chrome level, so an open modal
   still covers the dropdown rather than the other way round. */
.app-topbar {
  position: relative;
  z-index: var(--z-chrome);
  display: flex;
  justify-content: flex-end;
  padding: 18px 24px 0;
}
</style>
