<script setup lang="ts">
type AutoRevealMode = "off" | "video" | "info" | "both";

defineProps<{
  mode: AutoRevealMode;
  seconds: number;
}>();
const emit = defineEmits<{
  "update:mode": [AutoRevealMode];
  "update:seconds": [number];
  close: [];
}>();

const MODE_OPTIONS: { value: AutoRevealMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "video", label: "Video" },
  { value: "info", label: "Info" },
  { value: "both", label: "Both" },
];

const { isTypingTarget } = useHotkeyGuard();

function onKeydown(event: KeyboardEvent) {
  if (isTypingTarget(event)) return;
  if (event.key === "Escape") emit("close");
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="emit('close')">
      <div class="panel">
        <button type="button" class="close-btn" aria-label="Close" @click="emit('close')">✕</button>
        <h2 class="title">Auto Reveal</h2>
        <p class="hint">
          Hides the chosen target(s) - Video hides whichever visual applies (video or cover), Info hides the text
          panel - then reveals them after a timer.
        </p>
        <div class="mode-row">
          <button
            v-for="option in MODE_OPTIONS"
            :key="option.value"
            type="button"
            class="mode-btn"
            :class="{ on: mode === option.value }"
            @click="emit('update:mode', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <label v-if="mode !== 'off'" class="seconds-row">
          Reveal after
          <input
            type="number"
            min="1"
            max="30"
            step="1"
            class="seconds-input"
            :value="seconds"
            @change="emit('update:seconds', Number(($event.target as HTMLInputElement).value))"
          />
          sec
        </label>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 6, 15, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 50;
}

.panel {
  position: relative;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 28px;
  border-radius: var(--radius);
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
}

.title {
  margin: 0;
  padding-right: 36px;
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.mode-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mode-btn {
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

.mode-btn.on {
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
  box-shadow: 0 0 14px var(--accent-secondary-glow);
}

.seconds-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
}

.seconds-input {
  width: 48px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: inherit;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}
</style>
