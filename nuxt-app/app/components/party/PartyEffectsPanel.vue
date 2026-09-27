<script setup lang="ts">
import type { PartyEffects, PartyPicture } from "~/composables/usePartyDisplay";
import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();
const emit = defineEmits<{ command: [command: PartyHostCommand] }>();

const NO_EFFECTS: PartyEffects = { blur: 0, pixelate: 0, decay: false, decaySeconds: 20, muted: false, picture: "video" };
const PICTURES: { value: PartyPicture; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "blackout", label: "Blackout" },
  { value: "cover", label: "Cover art" },
];
const SEND_THROTTLE_MS = 150;

const target = ref<"current" | "next">("current");
const current = ref<PartyEffects>({ ...props.state.effects });
const next = ref<PartyEffects>({ ...(props.state.nextEffects ?? props.state.effects) });
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
    <p class="effects-hint">
      {{ target === "current" ? "Changes show on the display right away. They stay on for later songs until you change them. Reveal always shows the answer clearly." : "Set these up, then arm them. They switch on as the next song starts, so nobody sees it clear first." }}
    </p>

    <label class="fx-row">
      <span class="fx-label">Blur <span class="fx-value">{{ draft.blur ? `${draft.blur}px` : "off" }}</span></span>
      <input type="range" min="0" max="40" step="2" :value="draft.blur" @input="update({ blur: numberFrom($event) })" />
    </label>
    <label class="fx-row">
      <span class="fx-label">Pixelate <span class="fx-value">{{ draft.pixelate ? `${draft.pixelate}px blocks` : "off" }}</span></span>
      <input type="range" min="0" max="64" step="4" :value="draft.pixelate" @input="update({ pixelate: numberFrom($event) })" />
    </label>
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

.effects-hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
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
