<template>
  <div class="party-shell">
    <slot />
  </div>
</template>

<style scoped>
.party-shell {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
}
</style>
