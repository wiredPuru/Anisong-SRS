<script setup lang="ts">
export type KaiPose =
  | "cheer"
  | "slump"
  | "think"
  | "point"
  | "clap"
  | "surprised"
  | "laptop"
  | "giggle"
  | "sleepy"
  | "shy"
  | "peek"
  | "ready"
  | "wave";

// Native pixel size of each cutout in public/mascot/, cut from
// blueprint/reference/mascot-v2/kai-sheet-transparent.png. Each file is about
// 2x its largest on-screen height, so one file serves both densities, and the
// ratio sizes the box before the image loads.
const POSE_SIZES: Record<KaiPose, [number, number]> = {
  cheer: [537, 331],
  slump: [469, 332],
  think: [434, 347],
  point: [223, 219],
  clap: [210, 220],
  surprised: [203, 218],
  laptop: [221, 229],
  giggle: [203, 215],
  sleepy: [258, 207],
  shy: [190, 218],
  peek: [334, 115],
  ready: [190, 205],
  wave: [247, 203]
};

const HEIGHTS = { hero: 150, companion: 96, small: 56 } as const;

const props = withDefaults(
  defineProps<{ pose?: KaiPose; size?: keyof typeof HEIGHTS; alt?: string }>(),
  { pose: "wave", size: "companion", alt: "" }
);

const height = computed(() => HEIGHTS[props.size]);
const width = computed(() => {
  const [w, h] = POSE_SIZES[props.pose];
  return Math.round((w / h) * height.value);
});
</script>

<template>
  <img
    class="mascot-kai"
    :class="`mascot-kai-${size}`"
    :src="`/mascot/kai-${pose}.webp`"
    :width="width"
    :height="height"
    :alt="alt"
    decoding="async"
    draggable="false"
  />
</template>

<style scoped>
.mascot-kai {
  flex: none;
  display: block;
  width: auto;
  object-fit: contain;
  user-select: none;
}

.mascot-kai-hero {
  height: 150px;
}

.mascot-kai-companion {
  height: 96px;
}

.mascot-kai-small {
  height: 56px;
}

@media (max-width: 820px) {
  .mascot-kai-hero {
    height: 96px;
  }
}
</style>
