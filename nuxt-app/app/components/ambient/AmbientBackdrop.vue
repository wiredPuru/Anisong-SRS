<script setup lang="ts">
// Ambient mode outside the player: every page but Study and Listen (which
// paint their own glow from the live clip) shows the last played clip as a
// blurred backdrop, with the accents tinted to match. Follows the same
// Ambient toggle Study and Listen use; with nothing played yet, the page's
// own starry sky stays.
const AMBIENT_STORAGE_KEY = "gaqSrs:studyAmbientMode";
const PLAYER_ROUTES = ["/study", "/listen"];

const route = useRoute();
const { lastPlayed } = useLastPlayed();
const ambientOn = ref(false);

function readAmbientPreference() {
  try {
    const stored = localStorage.getItem(AMBIENT_STORAGE_KEY);
    ambientOn.value = stored !== null ? stored === "1" : window.innerWidth > 820;
  } catch {
    ambientOn.value = false;
  }
}

const onPlayerPage = computed(() => PLAYER_ROUTES.some((path) => route.path === path || route.path.startsWith(`${path}/`)));
const active = computed(() => ambientOn.value && !onPlayerPage.value && lastPlayed.value !== null);

const emit = defineEmits<{ "update:tint": [Record<string, string> | null] }>();

watch(
  () => route.path,
  () => {
    if (import.meta.client) readAmbientPreference();
  },
);

onMounted(readAmbientPreference);

watch(
  [active, () => lastPlayed.value?.tint],
  ([on, tint]) => {
    if (!import.meta.client) return;
    if (on) document.documentElement.setAttribute("data-ambient-backdrop", "true");
    else document.documentElement.removeAttribute("data-ambient-backdrop");
    emit("update:tint", on && tint ? tintStyle(tint) : null);
  },
  { immediate: true },
);

onUnmounted(() => document.documentElement.removeAttribute("data-ambient-backdrop"));
</script>

<template>
  <div v-if="active && lastPlayed" class="ambient-backdrop" aria-hidden="true">
    <img :src="lastPlayed.image" alt="" class="backdrop-image" />
    <div class="backdrop-vignette" />
  </div>
</template>

<style scoped>
.ambient-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  animation: backdrop-fade-in 0.8s ease-out;
}

/* Overscanned so the blur's soft edge falls outside the window. */
.backdrop-image {
  position: absolute;
  inset: -120px;
  width: calc(100% + 240px);
  height: calc(100% + 240px);
  object-fit: cover;
  filter: var(--ambient-backdrop-filter);
  opacity: var(--ambient-backdrop-opacity);
}

.backdrop-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(85% 85% at 50% 45%, transparent 45%, var(--scrim));
  opacity: 0.6;
}

@keyframes backdrop-fade-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ambient-backdrop {
    animation: none;
  }
}
</style>
