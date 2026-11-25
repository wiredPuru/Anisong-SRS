<script setup lang="ts">
import type { PartyThemeDecor } from "~/utils/partyThemes";

// The layer a theme draws behind every piece: Moe's sparkle sky and ticker,
// Christmas's snowfall and lights. Never catches the pointer.
const props = defineProps<{ decor: PartyThemeDecor; lobby: boolean }>();

// The lobby ticker repeats its phrase so one copy always fills the band while
// the other scrolls in behind it.
const TICKER = "♪ GAQ PARTY ☆ GUESS THE ANIME ☆ アニソン クイズ ☆ ";
const tickerRun = Array.from({ length: 6 }, () => TICKER);

// Fixed flake positions (a seeded spread), so the snow looks the same on every
// screen and nothing reshuffles when the state changes. Fewer, smaller flakes
// fall over a playing clip than over the lobby.
const FLAKES = (() => {
  let seed = 7;
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 90 }, () => ({ x: next() * 100, z: next(), delay: next(), drift: next() }));
})();
const flakes = computed(() => (props.lobby ? FLAKES : FLAKES.slice(0, 36)));
</script>

<template>
  <div v-if="decor === 'moe'" class="moe-sky" aria-hidden="true">
    <template v-if="lobby">
      <span v-for="index in 7" :key="index" class="moe-star">✦</span>
      <div class="moe-band moe-band-top">
        <div class="moe-ticker"><span v-for="(text, index) in tickerRun" :key="index">{{ text }}</span></div>
      </div>
      <div class="moe-band moe-band-bottom">
        <div class="moe-ticker"><span v-for="(text, index) in tickerRun" :key="index">{{ text }}</span></div>
      </div>
    </template>
  </div>

  <div v-else-if="decor === 'christmas'" class="xmas-sky" :class="{ 'is-lobby': lobby }" aria-hidden="true">
    <div v-if="lobby" class="xmas-lights" />
    <i
      v-for="(flake, index) in flakes"
      :key="index"
      class="xmas-flake"
      :style="{ left: `${flake.x}%`, '--z': flake.z.toFixed(2), '--delay': flake.delay.toFixed(2), '--drift': flake.drift.toFixed(2) }"
    />
  </div>
</template>
