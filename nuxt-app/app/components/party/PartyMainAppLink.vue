<script setup lang="ts">
import { mainAppHref } from "~/utils/deckLinks";

// gaq-party serves none of the main app's pages, so this opens the separately
// running GAQ SRS. With no slot it renders a small arrow for rows whose text
// already sits inside a button, where a nested link would be invalid.
const props = defineProps<{ path: string; label: string }>();
const slots = useSlots();
const config = useRuntimeConfig();
const href = computed(() => mainAppHref(String(config.public.mainAppUrl), props.path));
const title = computed(() => `Open ${props.label} in GAQ SRS (needs it running on this computer)`);
</script>

<template>
  <a
    class="main-app-link"
    :class="{ 'main-app-icon': !slots.default }"
    :href="href"
    target="_blank"
    rel="noopener"
    draggable="false"
    :title="title"
    :aria-label="slots.default ? undefined : title"
    @click.stop
  >
    <slot><span aria-hidden="true">&#8599;</span></slot>
  </a>
</template>

<style scoped>
.main-app-link {
  color: inherit;
  text-decoration: none;
}

.main-app-link:hover,
.main-app-link:focus-visible {
  text-decoration: underline;
}

.main-app-icon {
  flex: none;
  display: grid;
  place-items: center;
  min-width: 28px;
  padding: 0 6px;
  color: var(--muted);
  font-size: 15px;
}

.main-app-icon:hover,
.main-app-icon:focus-visible {
  color: var(--accent);
  text-decoration: none;
}
</style>
