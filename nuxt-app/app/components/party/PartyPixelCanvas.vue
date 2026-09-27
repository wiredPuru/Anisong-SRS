<script setup lang="ts">
const props = defineProps<{ source: HTMLVideoElement | HTMLImageElement | null; blockSize: number }>();

const canvas = ref<HTMLCanvasElement | null>(null);
// Drawn small, then scaled up with smoothing off: each small pixel becomes one
// visible block.
const small = typeof document === "undefined" ? null : document.createElement("canvas");
let frame = 0;

function sourceSize(source: HTMLVideoElement | HTMLImageElement): [number, number] {
  return source instanceof HTMLVideoElement
    ? [source.videoWidth, source.videoHeight]
    : [source.naturalWidth, source.naturalHeight];
}

function draw() {
  frame = requestAnimationFrame(draw);
  const target = canvas.value;
  const source = props.source;
  const ctx = target?.getContext("2d");
  const smallCtx = small?.getContext("2d");
  if (!target || !source || !ctx || !small || !smallCtx || props.blockSize <= 0) return;

  const [sourceW, sourceH] = sourceSize(source);
  if (!sourceW || !sourceH) return;

  const width = target.clientWidth;
  const height = target.clientHeight;
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }

  // object-fit: contain, the same framing as the unpixelated picture.
  const scale = Math.min(width / sourceW, height / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const x = (width - drawW) / 2;
  const y = (height - drawH) / 2;

  const smallW = Math.max(1, Math.ceil(drawW / props.blockSize));
  const smallH = Math.max(1, Math.ceil(drawH / props.blockSize));
  small.width = smallW;
  small.height = smallH;
  smallCtx.drawImage(source, 0, 0, smallW, smallH);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(small, 0, 0, smallW, smallH, x, y, drawW, drawH);
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
}
</style>
