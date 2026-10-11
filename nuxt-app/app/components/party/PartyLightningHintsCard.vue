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
</template>

<style scoped>
.hints-card {
  /* The backdrop's old padding, taken off the viewport width. */
  width: min(111vh, calc(100vw - 2 * clamp(16px, 4vw, 5.93vh)));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(16px, 3vh, 3.33vh);
}

.hints-banner {
  font-size: clamp(20px, 2.6vw, 4.07vh);
}

.clues {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: clamp(10px, 1.5vw, 2.22vh);
  width: 100%;
}

.clue {
  padding: clamp(12px, 2vh, 2.22vh);
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  text-align: center;
  animation: pop-in 260ms ease-out;
}

.clue dt {
  color: var(--muted);
  font-size: clamp(13px, 1.3vw, 2.04vh);
}

.clue dd {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: clamp(20px, 2.6vw, 4.07vh);
  color: var(--text);
}

.tags {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(8px, 1.2vw, 1.67vh);
}

.tag {
  padding: 0.35em 0.9em;
  border: 2px solid var(--accent);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--accent);
  font-family: var(--font-display);
  font-size: clamp(18px, 2.4vw, 3.7vh);
  animation: pop-in 260ms ease-out;
}

.title-mask {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.12em;
  font-family: var(--font-display);
  font-size: clamp(28px, 5vw, 8.15vh);
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
