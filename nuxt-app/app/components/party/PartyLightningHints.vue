<script setup lang="ts">
import type { PartyHints } from "~/composables/usePartyDisplay";

defineProps<{ hints: NonNullable<PartyHints> }>();

const TITLES: Record<NonNullable<PartyHints>["kind"], string> = {
  clues: "Clues",
  tags: "Tags",
  title: "Title",
};
</script>

<template>
  <div class="hints">
    <div class="hints-card">
      <p class="kai-banner kai-banner-neutral hints-banner">{{ TITLES[hints.kind] }}</p>

      <dl v-if="hints.kind === 'clues'" class="clues">
        <div v-for="clue in hints.items" :key="clue.label" class="clue">
          <dt>{{ clue.label }}</dt>
          <dd>{{ clue.value }}</dd>
        </div>
      </dl>

      <ul v-else-if="hints.kind === 'tags'" class="tags">
        <li v-for="tag in hints.items" :key="tag" class="tag">{{ tag }}</li>
      </ul>

      <p v-else class="title-mask">
        <span
          v-for="(char, index) in [...hints.masked]"
          :key="index"
          class="title-char"
          :class="{ hidden: char === '_', space: char === ' ' }"
        >{{ char === "_" ? "" : char }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.hints {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(16px, 4vw, 64px);
  background: var(--bg);
}

.hints-card {
  width: min(1200px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(16px, 3vh, 36px);
}

.hints-banner {
  font-size: clamp(20px, 2.6vw, 44px);
}

.clues {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: clamp(10px, 1.5vw, 24px);
  width: 100%;
}

.clue {
  padding: clamp(12px, 2vh, 24px);
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  text-align: center;
  animation: pop-in 260ms ease-out;
}

.clue dt {
  color: var(--muted);
  font-size: clamp(13px, 1.3vw, 22px);
}

.clue dd {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: clamp(20px, 2.6vw, 44px);
  color: var(--text);
}

.tags {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(8px, 1.2vw, 18px);
}

.tag {
  padding: 0.35em 0.9em;
  border: 2px solid var(--accent);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--accent);
  font-family: var(--font-display);
  font-size: clamp(18px, 2.4vw, 40px);
  animation: pop-in 260ms ease-out;
}

.title-mask {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.12em;
  font-family: var(--font-display);
  font-size: clamp(28px, 5vw, 88px);
  line-height: 1.2;
}

.title-char {
  min-width: 0.7em;
  text-align: center;
}

.title-char.hidden {
  border-bottom: 0.08em solid var(--accent);
}

.title-char.space {
  min-width: 0.45em;
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
}

@media (prefers-reduced-motion: reduce) {
  .clue,
  .tag {
    animation: none;
  }
}
</style>
