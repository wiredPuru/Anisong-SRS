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
   intrinsic width instead of pushing the rail off-screen. */
.app-content {
  flex: 1;
  min-width: 0;
}

/* The search dropdown is absolutely positioned inside NavSearch, and used to
   sit above page content via .app-nav's z-index. The rail keeps that for
   itself now, so the strip needs its own stacking context or the dropdown
   renders underneath the page. */
.app-topbar {
  position: relative;
  z-index: 100;
  display: flex;
  justify-content: flex-end;
  padding: 18px 24px 0;
}
</style>
