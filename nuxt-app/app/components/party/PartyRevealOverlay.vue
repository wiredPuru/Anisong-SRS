<script setup lang="ts">
import type { PartyAnswer } from "~/composables/usePartyDisplay";

const props = defineProps<{ answer: PartyAnswer }>();

const showRomaji = computed(() => props.answer.animeTitleRomaji !== props.answer.animeTitleEnglish);
const coverFailed = ref(false);
watch(() => props.answer.coverImageUrl, () => {
  coverFailed.value = false;
});
</script>

<template>
  <section class="reveal" aria-live="polite">
    <img
      v-if="answer.coverImageUrl && !coverFailed"
      class="reveal-cover"
      :src="answer.coverImageUrl"
      alt=""
      @error="coverFailed = true"
    />
    <div class="reveal-text">
      <p class="kai-banner kai-banner-pass reveal-banner">{{ formatThemeSlotLabel(answer.themeSlot) }}</p>
      <h2 class="reveal-title">{{ answer.animeTitleEnglish }}</h2>
      <p v-if="showRomaji" class="reveal-sub">{{ answer.animeTitleRomaji }}</p>
      <p class="reveal-song">
        <span class="reveal-song-title">{{ answer.songTitle }}</span>
        <span class="reveal-artist">{{ answer.artistName }}</span>
      </p>
    </div>
  </section>
</template>

<style scoped>
.reveal {
  width: min(1100px, calc(100vw - 32px));
  display: flex;
  align-items: center;
  gap: clamp(16px, 2vw, 32px);
  padding: clamp(16px, 2vw, 28px);
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--glass-surface-panel);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-soft);
  animation: reveal-in 320ms ease-out;
}

.reveal-cover {
  flex-shrink: 0;
  width: clamp(80px, 11vw, 170px);
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 2px solid var(--outline);
}

.reveal-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reveal-banner {
  align-self: flex-start;
  font-size: clamp(14px, 1.4vw, 22px);
}

.reveal-title {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: clamp(24px, 3.4vw, 54px);
  line-height: 1.1;
  color: var(--text);
}

.reveal-sub {
  margin: 0;
  color: var(--muted);
  font-size: clamp(15px, 1.6vw, 26px);
}

.reveal-song {
  margin: 6px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.2em 0.8em;
  font-size: clamp(16px, 1.8vw, 30px);
}

.reveal-song-title {
  font-weight: 700;
  color: var(--accent);
}

.reveal-artist {
  color: var(--text);
}

@keyframes reveal-in {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    animation: none;
  }
}
</style>
