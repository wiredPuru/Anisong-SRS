<script setup lang="ts">
defineProps<{
  hideVideo: boolean;
  hideInfo: boolean;
  hideCover: boolean;
  randomStart: boolean;
  ambientMode: boolean;
  autoReveal: boolean;
  autoRevealSeconds: number;
}>();
const emit = defineEmits<{
  "toggle-hide-video": [];
  "toggle-hide-info": [];
  "toggle-hide-cover": [];
  "toggle-random-start": [];
  "toggle-ambient-mode": [];
  "toggle-auto-reveal": [];
  "update-auto-reveal-seconds": [number];
}>();
</script>

<template>
  <div class="display-toggles">
    <button type="button" class="toggle-btn" :class="{ on: hideVideo }" @click="emit('toggle-hide-video')">
      Hide Video
      <span class="tooltip">Hotkey: V</span>
    </button>
    <button type="button" class="toggle-btn" :class="{ on: hideInfo }" @click="emit('toggle-hide-info')">
      Hide Info
      <span class="tooltip">Hotkey: I</span>
    </button>
    <button type="button" class="toggle-btn" :class="{ on: hideCover }" @click="emit('toggle-hide-cover')">
      Hide Cover
      <span class="tooltip">Hotkey: C</span>
    </button>
    <button
      type="button"
      class="toggle-btn"
      :class="{ on: autoReveal }"
      :disabled="!hideInfo"
      @click="emit('toggle-auto-reveal')"
    >
      Auto Reveal
      <span class="tooltip">Reveals Hide Info automatically after a short timer</span>
    </button>
    <label v-if="autoReveal" class="toggle-btn auto-reveal-seconds">
      <input
        type="number"
        min="1"
        max="30"
        step="1"
        class="auto-reveal-seconds-input"
        :value="autoRevealSeconds"
        :disabled="!hideInfo"
        @change="emit('update-auto-reveal-seconds', Number(($event.target as HTMLInputElement).value))"
      />
      sec
    </label>
    <button type="button" class="toggle-btn" :class="{ on: randomStart }" @click="emit('toggle-random-start')">
      Start at random times
    </button>
    <button type="button" class="toggle-btn" :class="{ on: ambientMode }" @click="emit('toggle-ambient-mode')">
      Ambient mode
      <span class="tooltip">Hotkey: A</span>
    </button>
  </div>
</template>

<style scoped>
.display-toggles {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.toggle-btn {
  position: relative;
  padding: 9px 16px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3px;
  cursor: pointer;
}

.toggle-btn.on {
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
  box-shadow: 0 0 14px var(--accent-secondary-glow);
}

.toggle-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Reuses .toggle-btn's own pill (padding/border/background/color/font) so
   this sits and blends exactly like its sibling toggle buttons - including
   the shared [data-ambient-glass="true"] .display-toggles .toggle-btn rule
   in main.css, which this needs too since it lives in the same row. */
.auto-reveal-seconds {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: default;
}

.auto-reveal-seconds-input {
  width: 32px;
  padding: 2px 4px;
  border: none;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.auto-reveal-seconds-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: normal;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 5;
}

.toggle-btn:hover .tooltip,
.toggle-btn:focus-visible .tooltip {
  opacity: 1;
  visibility: visible;
}
</style>
