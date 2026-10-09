<script setup lang="ts">
const props = defineProps<{
  themeSlot: string;
  animeTitleEnglish: string;
  animeTitleNative: string;
  songTitle: string;
  artistName: string;
  // Placeholders only while hidden, so no answer is in the DOM for a screen
  // reader or Migaku to read out early.
  hidden?: boolean;
  revealable?: boolean;
}>();

const emit = defineEmits<{ reveal: [] }>();

const native = computed(() =>
  props.animeTitleNative && props.animeTitleNative !== props.animeTitleEnglish ? props.animeTitleNative : null,
);
</script>

<template>
  <section class="lower-third" :class="{ hidden }" :aria-label="hidden ? 'Song information, hidden' : 'Song information'">
    <template v-if="hidden">
      <span class="bar bar-wide" aria-hidden="true" />
      <span class="bar bar-short" aria-hidden="true" />
      <button
        v-if="revealable"
        type="button"
        class="reveal-target"
        aria-label="Reveal song information"
        @click="emit('reveal')"
        @keydown.enter.stop
        @keydown.space.stop
      />
    </template>
    <template v-else>
      <p class="kicker">
        <span class="slot">{{ formatThemeSlotLabel(themeSlot) }}</span>
        <span v-if="native" lang="ja">{{ native }}</span>
      </p>
      <p class="title">{{ animeTitleEnglish }}</p>
      <p class="song">{{ songTitle }} &middot; {{ artistName }}</p>
    </template>
  </section>
</template>

<style scoped>
/* A caption over the bottom of the video, sized in cqw against the player
   frame (a size container) so it scales with the picture. */
.lower-third {
  position: relative;
  max-width: min(100%, 720px);
  padding: clamp(10px, 1.1cqw, 18px) clamp(16px, 1.7cqw, 26px);
  border-radius: calc(var(--radius) + 2px);
  border: 1px solid var(--glass-border);
  background: var(--glass-surface-panel);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-soft);
  color: var(--text);
  pointer-events: auto;
}

.lower-third p {
  margin: 0;
  overflow-wrap: anywhere;
}

.kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: clamp(12px, 0.95cqw, 15px);
}

.slot {
  padding: 1px 9px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  font-size: 0.82em;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.title {
  margin-top: 2px !important;
  font: 400 clamp(20px, 2.2cqw, 34px) / 1.2 var(--font-display);
}

.song {
  margin-top: 2px !important;
  color: var(--muted);
  font-size: clamp(13px, 1.1cqw, 17px);
  font-weight: 700;
}

.hidden {
  display: grid;
  gap: 12px;
  width: min(100%, 420px);
  padding-block: clamp(16px, 1.6cqw, 24px);
}

.bar {
  display: block;
  height: 14px;
  border-radius: var(--radius-pill);
  background: var(--glass-border);
}

.bar-wide {
  width: 72%;
}

.bar-short {
  width: 44%;
  height: 10px;
  opacity: 0.6;
}

.reveal-target {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: transparent;
  border-radius: inherit;
  cursor: pointer;
}
</style>
