<script setup lang="ts">
import type { BonusCategoryResult } from "~/utils/quizScore";

const props = defineProps<{
  result: "pass" | "fail";
  selectedTitle: string | null;
  correctTitle: string;
  pointsAwarded: number;
  bonusResults: BonusCategoryResult[];
  score: number;
  combo: number;
  busy: boolean;
  retry: boolean;
}>();
const emit = defineEmits<{ continue: [] }>();
const resultPanel = ref<HTMLElement | null>(null);
const continueButton = ref<HTMLButtonElement | null>(null);

const heading = computed(() => (props.result === "pass" ? "Correct!" : props.selectedTitle ? "Wrong..." : "Answer revealed"));
const kaiPose = computed(() => (props.result === "pass" ? "cheer" : props.selectedTitle ? "slump" : "think"));
const bannerClass = computed(() =>
  props.result === "pass" ? "kai-banner-pass" : props.selectedTitle ? "kai-banner-fail" : "kai-banner-neutral",
);
const niceGuess = computed(() => props.bonusResults.some((bonus) => bonus.pointsAwarded > 0));

const BONUS_CATEGORY_LABELS: Record<BonusCategoryResult["category"], string> = {
  songName: "Song name",
  themeSlot: "Opening/Ending",
  artist: "Artist",
};

onMounted(() => nextTick(() => {
  resultPanel.value?.scrollIntoView({ block: "start", behavior: "auto" });
  continueButton.value?.focus({ preventScroll: true });
}));
</script>

<template>
  <section ref="resultPanel" class="quiz-result" :class="result" role="status" aria-live="polite" aria-atomic="true">
    <div class="result-kai" aria-hidden="true">
      <span v-if="result === 'pass'" class="kai-stars"><span>★</span><span>★</span><span>★</span></span>
      <MascotKai :pose="kaiPose" size="companion" />
    </div>
    <p v-if="niceGuess" class="nice-guess" aria-hidden="true">Nice Guess!</p>
    <div class="result-copy">
      <p class="eyebrow">Quiz result</p>
      <h2 class="kai-banner" :class="bannerClass">{{ heading }}</h2>
      <p v-if="result === 'fail' && selectedTitle && selectedTitle !== correctTitle" class="selected-answer">
        <span>Your answer</span>
        {{ selectedTitle }}
      </p>
      <p class="correct-answer">
        <span>{{ result === "pass" ? "You named it" : "Correct answer" }}</span>
        {{ correctTitle }}
      </p>
      <ul v-if="bonusResults.length" class="bonus-results">
        <li
          v-for="(bonus, index) in bonusResults"
          :key="bonus.category"
          class="bonus-row"
          :class="{ correct: bonus.correct }"
          :style="{ animationDelay: `${140 + index * 180}ms` }"
        >
          <span class="bonus-icon" aria-hidden="true">{{ bonus.correct ? "✓" : "✕" }}</span>
          <span class="bonus-label">{{ BONUS_CATEGORY_LABELS[bonus.category] }}<template v-if="bonus.required"> (required)</template></span>
          <span class="bonus-answer">
            {{ bonus.correct ? bonus.correctLabel : `${bonus.selectedLabel} → ${bonus.correctLabel}` }}
          </span>
          <strong v-if="!bonus.required" class="bonus-points" :class="{ empty: bonus.pointsAwarded === 0 }">
            {{ bonus.pointsAwarded > 0 ? `+${bonus.pointsAwarded}` : "+0" }}
          </strong>
        </li>
      </ul>
      <div class="reward-row">
        <strong class="points" :class="{ empty: pointsAwarded === 0 }">
          {{ pointsAwarded > 0 ? `+${pointsAwarded}` : "+0" }}
          <small>points</small>
        </strong>
        <span class="total">{{ score.toLocaleString() }} total</span>
        <span v-if="combo > 1" class="combo">🔥 {{ combo }}x combo</span>
      </div>
      <p class="listen-hint">Keep listening, then continue when you’re ready.</p>
      <button ref="continueButton" type="button" :disabled="busy" @click="emit('continue')">
        {{ retry ? "Retry next card" : "Continue" }}
        <kbd>Enter</kbd>
      </button>
    </div>
  </section>
</template>

<style scoped>
.quiz-result {
  position: relative;
  isolation: isolate;
  flex: none;
  display: grid;
  grid-template-columns: 124px minmax(0, 1fr);
  gap: 18px;
  overflow: hidden;
  padding: 20px;
  border: 2px solid var(--result-color);
  border-radius: var(--radius);
  background:
    radial-gradient(circle at 8% 15%, color-mix(in srgb, var(--result-color) 22%, transparent), transparent 34%),
    color-mix(in srgb, var(--result-color) 7%, var(--surface));
  box-shadow: 0 10px 34px color-mix(in srgb, var(--result-color) 22%, transparent);
  animation: result-arrive 360ms cubic-bezier(0.2, 0.9, 0.25, 1.15);
}

.quiz-result.pass { --result-color: var(--pass); --result-ink: var(--pass-ink); }
.quiz-result.fail { --result-color: var(--fail); --result-ink: var(--fail-ink); }

.result-kai {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  animation: result-burst 480ms cubic-bezier(0.15, 1.3, 0.35, 1);
}

.result-kai :deep(.mascot-kai) {
  max-width: 100%;
  height: auto;
  max-height: 110px;
}

.kai-stars span {
  position: absolute;
  z-index: 1;
  color: var(--star);
  font-size: 18px;
  animation: star-twinkle 1.4s ease-in-out infinite;
}

.kai-stars span:nth-child(1) { top: -6px; left: 0; }
.kai-stars span:nth-child(2) { top: 30px; right: -4px; font-size: 14px; animation-delay: 0.4s; }
.kai-stars span:nth-child(3) { top: 74px; left: -6px; font-size: 12px; animation-delay: 0.8s; }

@keyframes star-twinkle {
  0%, 100% { transform: scale(0.8) rotate(-10deg); opacity: 0.7; }
  50% { transform: scale(1.15) rotate(10deg); opacity: 1; }
}

/* the sheet's tilted pink "Nice Guess!" lettering, stuck on the corner */
.nice-guess {
  position: absolute;
  top: 4px;
  right: 14px;
  z-index: 1;
  margin: 0;
  color: var(--accent);
  font-family: var(--font-display);
  font-size: 18px;
  transform: rotate(-8deg);
  text-shadow: 0 2px 0 var(--surface), 0 0 10px var(--accent-glow);
  animation: nice-guess-in 420ms 300ms both cubic-bezier(0.2, 1.4, 0.3, 1);
}

.nice-guess::before,
.nice-guess::after {
  content: "★";
  position: absolute;
  color: var(--star);
  font-size: 12px;
}

.nice-guess::before { top: -8px; left: -12px; }
.nice-guess::after { bottom: -6px; right: -12px; }

@keyframes nice-guess-in { from { opacity: 0; transform: rotate(-24deg) scale(0.4); } }

.result-copy { min-width: 0; }
.eyebrow { margin: 0 0 2px; color: var(--result-color); font-size: 10px; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase; }
h2 { max-width: 100%; margin: 2px 0 14px; font-size: clamp(18px, 1.9vw, 26px); overflow-wrap: anywhere; }
.selected-answer, .correct-answer { margin: 6px 0; color: var(--text); overflow-wrap: anywhere; }
.selected-answer { color: var(--muted); }
.selected-answer span, .correct-answer span { display: block; color: var(--faint); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.correct-answer { font-size: 17px; font-weight: 700; }

.bonus-results { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.bonus-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 9px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  font-size: 12px;
  /* Delay is per row (set inline), so the rows arrive one at a time instead
     of the whole list appearing at once. */
  animation: bonus-row-in 320ms both cubic-bezier(0.2, 1.3, 0.3, 1);
}

@keyframes bonus-row-in {
  from { opacity: 0; transform: translateX(-14px) scale(0.94); }
}
.bonus-icon { color: var(--fail); font-weight: 700; }
.bonus-row.correct .bonus-icon { color: var(--pass); }
.bonus-label { flex: none; color: var(--faint); font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; font-size: 10px; }
.bonus-answer { flex: 1; min-width: 0; color: var(--text); overflow-wrap: anywhere; }
.bonus-points { flex: none; color: var(--result-color); font-family: var(--font-display); font-size: 14px; }
.bonus-points.empty { color: var(--faint); }

.reward-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; margin-top: 14px; }
.points { color: var(--result-color); font-family: var(--font-display); font-size: 25px; animation: points-pop 520ms 140ms both cubic-bezier(0.2, 1.4, 0.3, 1); }
.points.empty { color: var(--faint); }
.points small { font-family: var(--font-sans); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
.total, .combo { padding: 4px 9px; border-radius: var(--radius-pill); background: var(--surface-raised); color: var(--muted); font-size: 11px; font-weight: 700; }
.combo { color: var(--warning); }
.listen-hint { margin: 12px 0; color: var(--muted); font-size: 12px; }

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-width: 180px;
  padding: 10px 18px;
  border: 1px solid var(--result-color);
  border-radius: var(--radius-pill);
  background: var(--result-color);
  color: var(--result-ink);
  font: 700 14px var(--font-sans);
  cursor: pointer;
}
button:hover { filter: brightness(1.08); }
button:disabled { opacity: 0.6; cursor: wait; }
kbd { padding: 2px 6px; border: 1px solid color-mix(in srgb, var(--result-ink) 45%, transparent); border-radius: var(--radius-xs); font: inherit; font-size: 10px; }

@keyframes result-arrive { from { opacity: 0; transform: translateY(10px) scale(0.98); } }
@keyframes result-burst { from { opacity: 0; transform: rotate(-18deg) scale(0.45); } }
@keyframes points-pop { from { opacity: 0; transform: translateY(8px) scale(0.65); } }

@media (max-width: 520px) {
  .quiz-result { grid-template-columns: 1fr; }
  .result-kai { justify-content: flex-start; }
  button { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .quiz-result, .result-kai, .points, .bonus-row, .nice-guess, .kai-stars span { animation: none; }
}
</style>
