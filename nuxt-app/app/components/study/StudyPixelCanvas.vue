<script setup lang="ts">
// Draws the playing video small, then scales it up with smoothing off so each
// small pixel becomes one visible block (feature 125). The canvas is tainted by
// a cross-origin clip, which is fine for display; never read pixels back from it.
const props = defineProps<{ source: HTMLVideoElement | null }>();

const BLOCK_FRACTION = 1 / 20;
const MIN_BLOCK_PX = 12;

const canvas = ref<HTMLCanvasElement | null>(null);
const small = typeof document === "undefined" ? null : document.createElement("canvas");
let frame = 0;

function draw() {
  frame = requestAnimationFrame(draw);
  const target = canvas.value;
  const source = props.source;
  const ctx = target?.getContext("2d");
  const smallCtx = small?.getContext("2d");
  if (!target || !source || !ctx || !small || !smallCtx || source.readyState < 2) return;

  const sourceW = source.videoWidth;
  const sourceH = source.videoHeight;
  if (!sourceW || !sourceH) return;

  const width = target.clientWidth;
  const height = target.clientHeight;
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }

  // object-fit: contain, the same framing as the video element it replaces.
  const scale = Math.min(width / sourceW, height / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const block = Math.max(MIN_BLOCK_PX, drawW * BLOCK_FRACTION);
  const smallW = Math.max(1, Math.ceil(drawW / block));
  const smallH = Math.max(1, Math.ceil(drawH / block));
  if (small.width !== smallW || small.height !== smallH) {
    small.width = smallW;
    small.height = smallH;
  }
  smallCtx.drawImage(source, 0, 0, smallW, smallH);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(small, 0, 0, smallW, smallH, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
}

onMounted(() => {
  frame = requestAnimationFrame(draw);
});
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <canvas ref="canvas" class="pixel-canvas" aria-hidden="true" />
</template>

<style scoped>
.pixel-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
