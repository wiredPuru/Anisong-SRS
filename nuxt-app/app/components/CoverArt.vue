<script setup lang="ts">
import { coverInitial, coverTint } from "~/utils/coverFallback";
import { networkImageSrc } from "~/utils/networkImage";

const props = defineProps<{
  src: string | null | undefined;
  // The name the fallback letter comes from, and the id its tint is hashed from.
  label: string;
  seed: number;
}>();

const { offlineMode } = useNetworkMode();
const failed = ref(false);
watch(() => props.src, () => (failed.value = false));
// NetworkImage renders nothing for a remote cover in offline mode, without an
// error event, so that case falls back here too.
const usable = computed(() => !failed.value && !!networkImageSrc(props.src, offlineMode.value));
</script>

<template>
  <NetworkImage v-if="usable" :src="src" alt="" class="cover-art" @error="failed = true" />
  <span v-else class="cover-art cover-art-fallback" :style="{ '--tint': `var(${coverTint(seed)})` }" aria-hidden="true">
    <span class="cover-art-letter">{{ coverInitial(label) }}</span>
  </span>
</template>

<style scoped>
.cover-art {
  display: block;
  object-fit: cover;
}

/* The deck tiles' no-cover look: a tinted wash with a faint dot pattern and
   the first letter. Sized by its container, so callers set width and height. */
.cover-art-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  container-type: size;
  background:
    radial-gradient(color-mix(in srgb, var(--tint) 22%, transparent) 1.2px, transparent 1.6px) 0 0 / 10px 10px,
    linear-gradient(160deg, color-mix(in srgb, var(--tint) 28%, var(--surface-raised)), color-mix(in srgb, var(--tint) 10%, var(--surface-raised)));
}

.cover-art-letter {
  font-family: var(--font-display);
  font-size: clamp(14px, 45cqmin, 64px);
  line-height: 1;
  color: var(--tint);
  text-shadow: 0 2px 0 color-mix(in srgb, var(--tint) 22%, transparent);
}
</style>
