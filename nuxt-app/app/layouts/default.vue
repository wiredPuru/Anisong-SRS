<template>
  <div class="app-shell">
    <NavBar />
    <div class="app-content">
      <div class="app-topbar">
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
   normal flow exactly as before. */
.app-content {
  flex: 1;
  min-width: 0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* The search dropdown is absolutely positioned inside NavSearch, and used to
   sit above page content via .app-nav's z-index. The rail keeps that for
   itself now, so the strip needs its own stacking context or the dropdown
   renders underneath the page. Chrome level, so an open modal still covers
   the dropdown rather than the other way round. */
.app-topbar {
  position: relative;
  z-index: var(--z-chrome);
  display: flex;
  justify-content: flex-end;
  padding: 18px 24px 0;
}
</style>
