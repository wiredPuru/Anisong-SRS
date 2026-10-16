<script setup lang="ts">
import type { PartyEffects } from "~/composables/usePartyDisplay";
import {
  EFFECT_GROUPS, NO_EFFECTS, PRESET_STORAGE_KEY, addPreset, isPlain, optionsIn, parsePresets, removePreset, setRandom, toggleOption,
  type EffectOption, type EffectPreset,
} from "~/utils/partyEffectOptions";

const props = defineProps<{ effects: PartyEffects | null; label: string }>();
const emit = defineEmits<{ change: [effects: PartyEffects | null] }>();

const presets = useState<EffectPreset[]>("partyEffectPresets", () => []);
const randomOn = computed(() => props.effects?.random === true);

onMounted(() => {
  try {
    presets.value = parsePresets(localStorage.getItem(PRESET_STORAGE_KEY));
  } catch {
    presets.value = [];
  }
});

function storePresets(next: EffectPreset[]) {
  presets.value = next;
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Presets just last for this visit when storage is blocked.
  }
}

function send(effects: PartyEffects) {
  emit("change", isPlain(effects) ? null : effects);
}

const toggle = (option: EffectOption) => send(toggleOption(props.effects ?? NO_EFFECTS, option));
const toggleRandom = () => send(setRandom(props.effects ?? NO_EFFECTS, !randomOn.value));

function savePreset() {
  const name = window.prompt("Name this preset");
  if (!name?.trim()) return;
  storePresets(addPreset(presets.value, { name, effects: props.effects ?? NO_EFFECTS }));
}
</script>

<template>
  <div class="fx-wrap">
    <div class="fx-row" role="group" :aria-label="label">
      <template v-for="group in EFFECT_GROUPS" :key="group.id">
        <span class="fx-group">{{ group.label }}</span>
        <button
          v-for="option in optionsIn(group.id)"
          :key="option.id"
          type="button"
          class="fx-chip"
          :class="{ on: effects && option.on(effects) }"
          :aria-pressed="Boolean(effects && option.on(effects))"
          @click="toggle(option)"
        >
          {{ option.label }}
        </button>
        <button v-if="group.id === 'effects'" type="button" class="fx-chip" :class="{ on: randomOn }" :aria-pressed="randomOn" title="Pick one of the effects at random for each song" @click="toggleRandom">Random</button>
      </template>
      <button v-if="effects" type="button" class="fx-chip fx-clear" @click="emit('change', null)">Clear</button>
      <button type="button" class="fx-chip" title="Save these toggles as a preset" @click="savePreset">Save</button>
    </div>
    <div v-if="presets.length" class="fx-row" role="group" aria-label="Saved presets">
      <span class="fx-group">Presets</span>
      <span v-for="preset in presets" :key="preset.name" class="fx-preset">
        <button type="button" class="fx-chip" @click="send(preset.effects)">{{ preset.name }}</button>
        <button type="button" class="fx-chip fx-clear" :aria-label="`Delete preset ${preset.name}`" @click="storePresets(removePreset(presets, preset.name))">&times;</button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.fx-wrap {
  flex-basis: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fx-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.fx-group {
  font-size: 0.75rem;
  color: var(--muted);
  align-self: center;
}

.fx-preset {
  display: inline-flex;
  gap: 2px;
}

.fx-chip {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.fx-chip.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.fx-clear {
  border-style: dashed;
}
</style>
