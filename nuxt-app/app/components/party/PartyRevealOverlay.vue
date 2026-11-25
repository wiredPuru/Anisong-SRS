<script setup lang="ts">
import type { PartyAnswer } from "~/composables/usePartyDisplay";
import { revealFactLine } from "~/utils/partyRevealFacts";

const props = defineProps<{ answer: PartyAnswer }>();

const showRomaji = computed(() => props.answer.animeTitleRomaji !== props.answer.animeTitleEnglish);
const hasSong = computed(() => Boolean(props.answer.songTitle || props.answer.artistName));
const factLine = computed(() => revealFactLine(props.answer.facts));
const tags = computed(() => props.answer.facts?.tags ?? []);
const coverFailed = ref(false);
watch(() => props.answer.coverImageUrl, () => {
  coverFailed.value = false;
});
</script>

<template>
  <section class="reveal" aria-live="polite">
    <NetworkImage
      v-if="answer.coverImageUrl && !coverFailed"
      class="reveal-cover"
      :src="answer.coverImageUrl"
      alt=""
      @error="coverFailed = true"
    />
    <div class="reveal-text">
      <div class="reveal-head">
        <span v-if="answer.themeSlot" class="kai-banner kai-banner-pass reveal-banner">{{ formatThemeSlotLabel(answer.themeSlot) }}</span>
        <h2 v-if="answer.animeTitleEnglish" class="reveal-title">{{ answer.animeTitleEnglish }}</h2>
      </div>
      <p v-if="answer.animeTitleEnglish && showRomaji" class="reveal-sub">{{ answer.animeTitleRomaji }}</p>
      <p v-if="hasSong" class="reveal-song">
        <span v-if="answer.songTitle" class="reveal-song-title">{{ answer.songTitle }}</span>
        <span v-if="answer.artistName" class="reveal-artist">{{ answer.artistName }}</span>
      </p>
      <p v-if="factLine || tags.length" class="reveal-meta">
        <span v-if="factLine" class="reveal-facts">{{ factLine }}</span>
        <span v-for="tag in tags" :key="tag" class="reveal-tag">{{ tag }}</span>
      </p>
    </div>
  </section>
</template>

<style scoped>
/* Sized to its content (up to a cap) so a short answer makes a small card.
   The slot sits beside the title, and the show's details share one line with
   its tags, to keep the card short. */
.reveal {
  width: fit-content;
  max-width: min(110vh, calc(100vw - 32px));
  display: flex;
  align-items: center;
  gap: clamp(12px, 1.4vw, 2.1vh);
  padding: clamp(10px, 1.1vw, 1.7vh) clamp(14px, 1.5vw, 2.2vh);
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--glass-surface-panel);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-soft);
  animation: reveal-in 320ms ease-out;
}

.reveal-cover {
  flex-shrink: 0;
  height: clamp(72px, 8vw, 12.5vh);
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 2px solid var(--outline);
}

.reveal-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.reveal p {
  margin: 0;
}

.reveal-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.2em 0.6em;
}

.reveal-banner {
  flex-shrink: 0;
  font-size: clamp(12px, 1.1vw, 1.7vh);
}

.reveal-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(20px, 2.5vw, 3.8vh);
  line-height: 1.1;
  color: var(--text);
}

.reveal-sub {
  color: var(--muted);
  font-size: clamp(13px, 1.25vw, 1.95vh);
}

.reveal .reveal-song {
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 0.2em 0.7em;
  font-size: clamp(14px, 1.5vw, 2.3vh);
}

.reveal-song-title {
  font-weight: 700;
  color: var(--accent);
}

.reveal-artist {
  color: var(--text);
}

.reveal-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 6px;
}

.reveal-facts {
  margin-right: 4px;
  color: var(--muted);
  font-size: clamp(12px, 1.1vw, 1.7vh);
  font-weight: 700;
}

.reveal-tag {
  padding: 0.05em 0.65em;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--muted);
  font-size: clamp(11px, 0.95vw, 1.5vh);
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
