<script setup lang="ts">
import type { PartyEffects, PartyPicture } from "~/composables/usePartyDisplay";
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const NO_EFFECTS: PartyEffects = { blur: 0, pixelate: 0, decay: false, decaySeconds: 20, muted: false, picture: "video" };
const PICTURES: { value: PartyPicture; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "bubbles", label: "Bubbles" },
  { value: "music", label: "Music player" },
];
const SEND_THROTTLE_MS = 150;

const target = ref<"current" | "next">("current");
const current = ref<PartyEffects>({ ...props.state.effects });
const next = ref<PartyEffects>({ ...(props.state.nextEffects ?? NO_EFFECTS) });
const draft = computed(() => (target.value === "current" ? current.value : next.value));
const armed = computed(() => props.state.nextEffects !== null);

// The server is the source of truth for "This song"; follow it unless the
// host is mid-drag, when their own pending value wins.
let sendTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => props.state.effects,
  (effects) => {
    if (!sendTimer) current.value = { ...effects };
  },
);
watch(
  () => props.state.nextEffects,
  (effects) => {
    if (effects) next.value = { ...effects };
  },
);

function sendCurrent() {
  if (sendTimer) return;
  sendTimer = setTimeout(() => {
    sendTimer = null;
    emit("command", { type: "effects", target: "current", effects: { ...current.value } });
  }, SEND_THROTTLE_MS);
}

function update(patch: Partial<PartyEffects>) {
  if (target.value === "current") {
    current.value = { ...current.value, ...patch };
    sendCurrent();
  } else {
    next.value = { ...next.value, ...patch };
  }
}

// Blur and pixelate move in set steps rather than along a drag bar. Level 0
// is off; switching back on returns to the strength last used.
interface Stepped {
  key: "blur" | "pixelate";
  label: string;
  levels: number[];
  fallback: number;
}
const STEPPED: Stepped[] = [
  { key: "blur", label: "Blur", levels: [0, 4, 8, 14, 20, 30, 40], fallback: 3 },
  { key: "pixelate", label: "Pixelate", levels: [0, 8, 16, 24, 32, 48, 64], fallback: 3 },
];
const lastLevel = reactive<Record<Stepped["key"], number>>({ blur: 3, pixelate: 3 });

function levelIndex(row: Stepped, value: number): number {
  let best = 0;
  row.levels.forEach((level, i) => {
    if (Math.abs(level - value) < Math.abs(row.levels[best]! - value)) best = i;
  });
  return best;
}

function setLevel(row: Stepped, index: number) {
  const clamped = Math.min(row.levels.length - 1, Math.max(0, index));
  if (clamped > 0) lastLevel[row.key] = clamped;
  update({ [row.key]: row.levels[clamped]! });
}

function toggleStepped(row: Stepped) {
  setLevel(row, draft.value[row.key] > 0 ? 0 : lastLevel[row.key] || row.fallback);
}

function stepStepped(row: Stepped, direction: 1 | -1) {
  setLevel(row, levelIndex(row, draft.value[row.key]) + direction);
}

function numberFrom(event: Event): number {
  return Number((event.target as HTMLInputElement).value);
}

function arm() {
  emit("command", { type: "effects", target: "next", effects: { ...next.value } });
}

function cancelArmed() {
  emit("command", { type: "effects", target: "next", effects: null });
}

function reset() {
  if (target.value === "current") {
    current.value = { ...NO_EFFECTS };
    emit("command", { type: "effects", target: "current", effects: null });
  } else {
    next.value = { ...NO_EFFECTS };
  }
}

onBeforeUnmount(() => {
  if (sendTimer) clearTimeout(sendTimer);
});
</script>

<template>
  <section class="effects" aria-labelledby="effects-title">
    <div class="effects-head">
      <h2 id="effects-title" class="effects-title">Effects</h2>
      <div class="effects-tabs" role="tablist" aria-label="Apply effects to">
        <button type="button" role="tab" class="effects-tab" :class="{ active: target === 'current' }" :aria-selected="target === 'current'" @click="target = 'current'">
          This song
        </button>
        <button type="button" role="tab" class="effects-tab" :class="{ active: target === 'next' }" :aria-selected="target === 'next'" @click="target = 'next'">
          Next song<span v-if="armed" class="armed">Armed</span>
        </button>
      </div>
    </div>
    <p v-if="state.lightning" class="effects-paused">
      A lightning round is running, so its mode sets the screen. Only Mute applies until you stop the round.
    </p>
    <p class="effects-hint">
      {{ target === "current" ? "Changes show on the display right away. They last for this song only; the next song starts clear unless you armed Next song. Reveal always shows the answer clearly." : "Set these up, then arm them. They switch on as the next song starts, so nobody sees it clear first." }}
    </p>

    <div v-for="row in STEPPED" :key="row.key" class="fx-stepper">
      <span class="fx-label">{{ row.label }}</span>
      <button type="button" class="fx-toggle" :class="{ on: draft[row.key] > 0 }" :aria-pressed="draft[row.key] > 0" @click="toggleStepped(row)">
        {{ draft[row.key] > 0 ? "On" : "Off" }}
      </button>
      <button type="button" class="fx-step" :disabled="draft[row.key] <= 0" :aria-label="`Less ${row.label}`" @click="stepStepped(row, -1)">−</button>
      <span class="fx-pips" aria-hidden="true">
        <span v-for="n in row.levels.length - 1" :key="n" class="fx-pip" :class="{ lit: levelIndex(row, draft[row.key]) >= n }" />
      </span>
      <button type="button" class="fx-step" :disabled="levelIndex(row, draft[row.key]) >= row.levels.length - 1" :aria-label="`More ${row.label}`" @click="stepStepped(row, 1)">+</button>
    </div>
    <div class="fx-inline">
      <label class="fx-check">
        <input type="checkbox" :checked="draft.decay" @change="update({ decay: ($event.target as HTMLInputElement).checked })" />
        Clear over
      </label>
      <input
        class="fx-seconds"
        type="number"
        min="5"
        max="120"
        :value="draft.decaySeconds"
        :disabled="!draft.decay"
        aria-label="Seconds to clear"
        @change="update({ decaySeconds: numberFrom($event) })"
      />
      <span class="fx-unit">seconds</span>
    </div>
    <label class="fx-check">
      <input type="checkbox" :checked="draft.muted" @change="update({ muted: ($event.target as HTMLInputElement).checked })" />
      Mute
    </label>
    <div class="fx-picture" role="radiogroup" aria-label="Picture">
      <button
        v-for="option in PICTURES"
        :key="option.value"
        type="button"
        role="radio"
        class="fx-pill"
        :class="{ active: draft.picture === option.value }"
        :aria-checked="draft.picture === option.value"
        @click="update({ picture: option.value })"
      >
        {{ option.label }}
      </button>
    </div>

    <div class="fx-actions">
      <template v-if="target === 'next'">
        <button type="button" class="fx-btn primary" @click="arm">{{ armed ? "Update armed effects" : "Arm for next song" }}</button>
        <button v-if="armed" type="button" class="fx-btn" @click="cancelArmed">Cancel</button>
      </template>
      <button type="button" class="fx-btn" @click="reset">Reset</button>
    </div>
  </section>
</template>

<style scoped>
.effects {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.effects-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.effects-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
}

.effects-tabs {
  display: flex;
  gap: 6px;
}

.effects-tab,
.fx-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 2px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.effects-tab.active,
.fx-pill.active {
  border-color: var(--accent);
  color: var(--accent);
}

.armed {
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 11px;
  line-height: 18px;
}

.effects-paused {
  margin: 0;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  font-size: 13px;
  font-weight: 700;
}

.effects-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.fx-stepper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fx-stepper .fx-label {
  min-width: 5.5em;
  font-weight: 700;
}

.fx-toggle,
.fx-step {
  padding: 4px 12px;
  border: 2px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.fx-toggle.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.fx-step {
  width: 2.2em;
  padding: 4px 0;
}

.fx-step:disabled {
  opacity: 0.45;
  cursor: default;
}

.fx-pips {
  display: flex;
  gap: 3px;
}

.fx-pip {
  width: 10px;
  height: 18px;
  border-radius: 3px;
  background: var(--border);
}

.fx-pip.lit {
  background: var(--accent);
}

.fx-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fx-label {
  font-weight: 700;
  font-size: 14px;
}

.fx-value {
  margin-left: 6px;
  font-weight: 400;
  color: var(--muted);
}

.fx-row input[type="range"] {
  width: 100%;
  accent-color: var(--accent);
}

.fx-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fx-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
}

.fx-seconds {
  width: 72px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
}

.fx-unit {
  color: var(--muted);
  font-size: 14px;
}

.fx-picture,
.fx-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.fx-btn {
  padding: 8px 18px;
  border: 2px solid var(--accent-secondary);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.fx-btn.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}
</style>
