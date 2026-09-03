<script setup lang="ts">
type AutoRevealMode = "off" | "video" | "info" | "both";

defineProps<{
  hideVideo: boolean;
  hideInfo: boolean;
  hideCover: boolean;
  randomStart: boolean;
  ambientMode: boolean;
  audioOnly: boolean;
  autoRevealMode: AutoRevealMode;
  autoRevealSeconds: number;
}>();
const emit = defineEmits<{
  "toggle-hide-video": [];
  "toggle-hide-info": [];
  "toggle-hide-cover": [];
  "toggle-random-start": [];
  "toggle-ambient-mode": [];
  "toggle-audio-only": [];
  "update:auto-reveal-mode": [AutoRevealMode];
  "update:auto-reveal-seconds": [number];
}>();

const showAutoRevealSettings = ref(false);
</script>

<template>
  <div class="display-toggles">
    <!-- Labels read positive ("Video" lit = video showing) while the state
         stays negative: the props are still hideVideo/hideCover/hideInfo, so
         feature 46's Auto Reveal keeps forcing and reverting exactly the
         booleans it always did. Only the presentation is inverted. -->
    <div class="seg" role="group" aria-label="Show or hide parts of the card">
      <button
        type="button"
        class="seg-btn"
        :class="{ on: !hideVideo }"
        :aria-pressed="!hideVideo"
        @click="emit('toggle-hide-video')"
      >
        Video
        <span class="tooltip">Hotkey: V</span>
      </button>
      <button
        type="button"
        class="seg-btn"
        :class="{ on: !hideCover }"
        :aria-pressed="!hideCover"
        @click="emit('toggle-hide-cover')"
      >
        Cover
        <span class="tooltip">Hotkey: C</span>
      </button>
      <button
        type="button"
        class="seg-btn"
        :class="{ on: !hideInfo }"
        :aria-pressed="!hideInfo"
        @click="emit('toggle-hide-info')"
      >
        Info
        <span class="tooltip">Hotkey: I</span>
      </button>
    </div>
    <button
      type="button"
      class="toggle-btn"
      :class="{ on: autoRevealMode !== 'off' }"
      :aria-pressed="autoRevealMode !== 'off'"
      @click="showAutoRevealSettings = true"
    >
      Auto reveal
      <span class="tooltip">Choose what it hides (video/cover, info, or both) and its timer</span>
    </button>
    <button
      type="button"
      class="toggle-btn"
      :class="{ on: randomStart }"
      :aria-pressed="randomStart"
      @click="emit('toggle-random-start')"
    >
      Random start
    </button>
    <button
      type="button"
      class="toggle-btn"
      :class="{ on: ambientMode }"
      :aria-pressed="ambientMode"
      @click="emit('toggle-ambient-mode')"
    >
      Ambient
      <span class="tooltip">Hotkey: A</span>
    </button>
    <button
      type="button"
      class="toggle-btn"
      :class="{ on: audioOnly }"
      :aria-pressed="audioOnly"
      @click="emit('toggle-audio-only')"
    >
      Audio only
      <span class="tooltip">Applies from the next card</span>
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
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* One joined control rather than three separate pills: Video, Cover and Info
   are the same decision (what of this card is visible), so the artboard
   groups them. Radii live on the group, not the segments. */
/* No overflow: hidden here, even though it would be the easy way to clip the
   segments to the group's radius - it would also clip each segment's tooltip.
   The segments round their own outer corners instead. */
.seg {
  display: flex;
  flex: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.seg-btn {
  position: relative;
  padding: 7px 12px;
  border: 0;
  border-left: 1px solid var(--border);
  background: none;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.seg-btn:first-child {
  border-left: 0;
  border-radius: calc(var(--radius-sm) - 1px) 0 0 calc(var(--radius-sm) - 1px);
}

.seg-btn:last-child {
  border-radius: 0 calc(var(--radius-sm) - 1px) calc(var(--radius-sm) - 1px) 0;
}

.seg-btn.on {
  background: var(--accent-secondary);
  color: var(--accent-ink);
}

.toggle-btn {
  position: relative;
  flex: none;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: none;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

/* Border and glow rather than a fill, matching the convention feature 24 set
   for active states so the control stays glass under ambient mode. */
.toggle-btn.on {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 14px var(--accent-glow);
}

.toggle-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Drops below the control, not above: these now live in the strip at the very
   top of the content column, where an upward tooltip has no room. */
.tooltip {
  position: absolute;
  top: calc(100% + 8px);
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
.toggle-btn:focus-visible .tooltip,
.seg-btn:hover .tooltip,
.seg-btn:focus-visible .tooltip {
  opacity: 1;
  visibility: visible;
}
</style>
