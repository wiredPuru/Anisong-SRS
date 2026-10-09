<script setup lang="ts">
const props = defineProps<{ source: HTMLVideoElement | null; seed: string }>();

const BUBBLE_COUNT = 14;
const canvas = ref<HTMLCanvasElement | null>(null);
let frame = 0;

interface Bubble {
  x: number;
  radius: number;
  speed: number;
  offset: number;
  sway: number;
}

// Fixed per song, so a re-render never reshuffles the bubbles.
function makeBubbles(seed: string): Bubble[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const random = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  return Array.from({ length: BUBBLE_COUNT }, () => ({
    x: 0.05 + random() * 0.9,
    radius: 0.05 + random() * 0.08,
    speed: 0.05 + random() * 0.07,
    offset: random(),
    sway: random() * Math.PI * 2,
  }));
}

let bubbles = makeBubbles(props.seed);
watch(() => props.seed, (seed) => {
  bubbles = makeBubbles(seed);
});

function draw(now: number) {
  frame = requestAnimationFrame(draw);
  const target = canvas.value;
  const source = props.source;
  const ctx = target?.getContext("2d");
  if (!target || !source || !ctx) return;
  const sourceW = source.videoWidth;
  const sourceH = source.videoHeight;
  if (!sourceW || !sourceH) return;

  const width = target.clientWidth;
  const height = target.clientHeight;
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }
  ctx.clearRect(0, 0, width, height);

  // object-fit: contain, the same framing as the plain picture.
  const scale = Math.min(width / sourceW, height / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const x = (width - drawW) / 2;
  const y = (height - drawH) / 2;
  const base = Math.min(width, height);
  const seconds = now / 1000;

  for (const bubble of bubbles) {
    const radius = bubble.radius * base;
    const travel = height + radius * 2;
    const cy = ((bubble.offset + seconds * bubble.speed) % 1) * travel - radius;
    const cx = bubble.x * width + Math.sin(seconds * 0.8 + bubble.sway) * radius * 0.6;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(source, x, y, drawW, drawH);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, radius * 0.06);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.stroke();
  }
}

onMounted(() => {
  frame = requestAnimationFrame(draw);
});
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <canvas ref="canvas" class="bubble-canvas" aria-hidden="true" />
</template>

<style scoped>
.bubble-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
