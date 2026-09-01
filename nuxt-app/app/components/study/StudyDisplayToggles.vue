<script setup lang="ts">
type AutoRevealMode = "off" | "video" | "info" | "both";

defineProps<{
  hideVideo: boolean;
  hideInfo: boolean;
  hideCover: boolean;
  randomStart: boolean;
  ambientMode: boolean;
  autoRevealMode: AutoRevealMode;
  autoRevealSeconds: number;
}>();
const emit = defineEmits<{
  "toggle-hide-video": [];
  "toggle-hide-info": [];
  "toggle-hide-cover": [];
  "toggle-random-start": [];
  "toggle-ambient-mode": [];
  "update:auto-reveal-mode": [AutoRevealMode];
  "update:auto-reveal-seconds": [number];
}>();

const showAutoRevealSettings = ref(false);
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
      :class="{ on: autoRevealMode !== 'off' }"
      @click="showAutoRevealSettings = true"
    >
      Auto Reveal
      <span class="tooltip">Choose what it hides (video/cover, info, or both) and its timer</span>
    </button>
    <button type="button" class="toggle-btn" :class="{ on: randomStart }" @click="emit('toggle-random-start')">
      Start at random times
    </button>
    <button type="button" class="toggle-btn" :class="{ on: ambientMode }" @click="emit('toggle-ambient-mode')">
      Ambient mode
      <span class="tooltip">Hotkey: A</span>
    </button>
    <StudyAutoRevealSettingsModal
      v-if="showAutoRevealSettings"
      :mode="autoRevealMode"
      :seconds="autoRevealSeconds"
      @update:mode="emit('update:auto-reveal-mode', $event)"
      @update:seconds="emit('update:auto-reveal-seconds', $event)"
      @close="showAutoRevealSettings = false"
    />
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
