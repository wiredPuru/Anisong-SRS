<script setup lang="ts">
const props = defineProps<{
  result: "pass" | "fail";
  selectedTitle: string | null;
  correctTitle: string;
  pointsAwarded: number;
  score: number;
  combo: number;
  busy: boolean;
  retry: boolean;
}>();
const emit = defineEmits<{ continue: [] }>();
const resultPanel = ref<HTMLElement | null>(null);
const continueButton = ref<HTMLButtonElement | null>(null);

const heading = computed(() => (props.result === "pass" ? "Correct!" : props.selectedTitle ? "Not quite" : "Answer revealed"));

onMounted(() => nextTick(() => {
  resultPanel.value?.scrollIntoView({ block: "start", behavior: "auto" });
  continueButton.value?.focus({ preventScroll: true });
}));
</script>

<template>
  <section ref="resultPanel" class="quiz-result" :class="result" role="status" aria-live="polite" aria-atomic="true">
    <div class="result-burst" aria-hidden="true">
      <span>{{ result === "pass" ? "✓" : "!" }}</span>
    </div>
    <div class="result-copy">
      <p class="eyebrow">Quiz result</p>
      <h2>{{ heading }}</h2>
      <p v-if="result === 'fail' && selectedTitle" class="selected-answer">
        <span>Your answer</span>
        {{ selectedTitle }}
      </p>
      <p class="correct-answer">
        <span>{{ result === "pass" ? "You named it" : "Correct answer" }}</span>
        {{ correctTitle }}
      </p>
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
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 18px;
  overflow: hidden;
  padding: 20px;
  border: 1px solid var(--result-color);
  border-radius: var(--radius);
  background:
    radial-gradient(circle at 8% 15%, color-mix(in srgb, var(--result-color) 22%, transparent), transparent 34%),
    color-mix(in srgb, var(--result-color) 7%, var(--surface));
  box-shadow: 0 10px 34px color-mix(in srgb, var(--result-color) 22%, transparent);
  animation: result-arrive 360ms cubic-bezier(0.2, 0.9, 0.25, 1.15);
}

.quiz-result.pass { --result-color: var(--pass); --result-ink: var(--pass-ink); }
.quiz-result.fail { --result-color: var(--fail); --result-ink: var(--fail-ink); }

.result-burst {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--result-color);
  color: var(--result-ink);
  box-shadow: 0 0 0 8px color-mix(in srgb, var(--result-color) 14%, transparent),
    0 0 28px color-mix(in srgb, var(--result-color) 45%, transparent);
  font-family: var(--font-display);
  font-size: 38px;
  animation: result-burst 480ms cubic-bezier(0.15, 1.3, 0.35, 1);
}

.result-copy { min-width: 0; }
.eyebrow { margin: 0 0 2px; color: var(--result-color); font-size: 10px; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase; }
h2 { margin: 0 0 12px; color: var(--text); font-family: var(--font-display); font-size: clamp(24px, 3vw, 34px); line-height: 1; }
.selected-answer, .correct-answer { margin: 6px 0; color: var(--text); overflow-wrap: anywhere; }
.selected-answer { color: var(--muted); }
.selected-answer span, .correct-answer span { display: block; color: var(--faint); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.correct-answer { font-size: 17px; font-weight: 700; }

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
  .result-burst { width: 58px; height: 58px; font-size: 30px; }
  button { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .quiz-result, .result-burst, .points { animation: none; }
}
</style>
