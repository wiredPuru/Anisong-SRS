<script setup lang="ts">
const props = defineProps<{ result: "pass" | "fail" | null }>();

interface Bit {
  id: number;
  style: Record<string, string>;
}

const COLORS = ["#7ee0a1", "#ffd76e", "#b9a7ff", "#ff9ec7", "#7fd4ff"];
const LIFETIME_MS = 2200;

const bits = ref<Bit[]>([]);
const kind = ref<"pass" | "fail">("pass");
let nextId = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function confetti(): Bit[] {
  return Array.from({ length: 46 }, (_, i) => ({
    id: nextId++,
    style: {
      left: `${rand(0, 100)}%`,
      background: COLORS[i % COLORS.length]!,
      "--dur": `${rand(1.1, 2.1)}s`,
      "--dx": `${rand(-60, 60)}px`,
      "--rot": `${rand(-360, 360)}deg`,
    },
  }));
}

function shards(): Bit[] {
  return Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    return {
      id: nextId++,
      style: {
        "--size": `${rand(30, 70)}px`,
        "--dx": `${Math.cos(angle) * 40}cqw`,
        "--dy": `${Math.sin(angle) * 45}cqh`,
        "--rot": `${rand(-250, 250)}deg`,
      },
    };
  });
}

watch(
  () => props.result,
  (result) => {
    if (timer) clearTimeout(timer);
    if (!result) {
      bits.value = [];
      return;
    }
    kind.value = result;
    bits.value = result === "pass" ? confetti() : shards();
    timer = setTimeout(() => {
      bits.value = [];
    }, LIFETIME_MS);
  },
);

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="result-fx" aria-hidden="true">
    <span v-for="bit in bits" :key="bit.id" class="bit" :class="kind" :style="bit.style" />
  </div>
</template>

<style scoped>
.result-fx {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  container-type: size;
  z-index: 6;
  border-radius: inherit;
}

.bit.pass {
  position: absolute;
  top: -20px;
  width: 9px;
  height: 14px;
  border-radius: 2px;
  animation: fx-fall var(--dur) ease-in forwards;
}

.bit.fail {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--size);
  height: var(--size);
  background: var(--fail);
  clip-path: polygon(50% 0, 100% 100%, 0 80%);
  animation: fx-burst 0.7s ease-out forwards;
}

@keyframes fx-fall {
  to {
    transform: translate(var(--dx), 110cqh) rotate(var(--rot));
    opacity: 0.9;
  }
}

@keyframes fx-burst {
  to {
    transform: translate(var(--dx), var(--dy)) rotate(var(--rot));
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .result-fx { display: none; }
}
</style>
