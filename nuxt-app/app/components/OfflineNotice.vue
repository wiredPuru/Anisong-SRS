<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string;
    // null drops the link, for doors that do not serve /settings.
    settingsHref?: string | null;
  }>(),
  { message: "Needs online mode.", settingsHref: "/settings?section=library" },
);
</script>

<template>
  <p class="offline-notice" role="status">
    <span><slot>{{ message }}</slot></span>
    <slot name="action">
      <NuxtLink v-if="settingsHref" :to="settingsHref" class="offline-notice-link">Open Settings</NuxtLink>
    </slot>
  </p>
</template>

<style scoped>
.offline-notice {
  margin: 0;
  padding: 4px 6px;
  color: var(--muted);
  font-size: 13px;
}

.offline-notice-link {
  margin-left: 6px;
  color: var(--accent-secondary);
  font-weight: 600;
}
</style>
