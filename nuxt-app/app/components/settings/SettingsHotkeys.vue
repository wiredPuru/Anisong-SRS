<script setup lang="ts">
import { captureKey, describeBindingFailure, hotkeyGroups } from "~/utils/hotkeyEditor";
import { formatKey, HOTKEY_ACTIONS, type HotkeyAction, type HotkeyActionId, type HotkeySlot } from "~/utils/hotkeys";

const hotkeys = useHotkeys();
const { bindings } = hotkeys;

const groups = hotkeyGroups();
const capturing = ref<{ id: HotkeyActionId; slot: HotkeySlot } | null>(null);
const message = ref<{ text: string; error: boolean } | null>(null);
const confirmingResetAll = ref(false);

const SLOTS: { slot: HotkeySlot; label: string }[] = [
  { slot: "primary", label: "Primary" },
  { slot: "alternate", label: "Alternate" },
];

const keyText = (id: HotkeyActionId, slot: HotkeySlot) => {
  const key = bindings.value[id][slot];
  return key === null ? null : formatKey(key);
};

const isCapturing = (id: HotkeyActionId, slot: HotkeySlot) => capturing.value?.id === id && capturing.value.slot === slot;

function isChanged(action: HotkeyAction): boolean {
  const current = bindings.value[action.id];
  return current.primary !== action.defaults.primary || current.alternate !== action.defaults.alternate;
}

function say(text: string, error = false) {
  message.value = { text, error };
}

function startCapture(id: HotkeyActionId, slot: HotkeySlot) {
  capturing.value = { id, slot };
  confirmingResetAll.value = false;
  message.value = null;
}

function applyKey(target: { id: HotkeyActionId; slot: HotkeySlot }, key: string | null) {
  const action = HOTKEY_ACTIONS.find((a) => a.id === target.id)!;
  const result = hotkeys.setBinding(target.id, target.slot, key);
  if (!result.ok) {
    say(describeBindingFailure(result, key ?? ""), true);
    return;
  }
  capturing.value = null;
  const slotName = target.slot === "primary" ? "Primary" : "Alternate";
  say(key === null ? `${action.label}: ${slotName.toLowerCase()} key cleared.` : `${action.label}: ${slotName.toLowerCase()} key is now ${formatKey(key)}.`);
}

// Capture phase and stopped, so the key being chosen does not also fire a hotkey.
function onCaptureKeydown(event: KeyboardEvent) {
  const target = capturing.value;
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  const outcome = captureKey(event);
  if (outcome.kind === "cancel") {
    capturing.value = null;
    message.value = null;
  }
  else if (outcome.kind === "clear") applyKey(target, null);
  else if (outcome.kind === "key") applyKey(target, outcome.key);
  else if (outcome.kind === "rejected") say(outcome.message, true);
}

function onOutsideMousedown(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest(".key-btn.capturing")) return;
  capturing.value = null;
}

watch(capturing, (now, before) => {
  if (now && !before) {
    window.addEventListener("keydown", onCaptureKeydown, true);
    window.addEventListener("mousedown", onOutsideMousedown);
  } else if (!now && before) {
    window.removeEventListener("keydown", onCaptureKeydown, true);
    window.removeEventListener("mousedown", onOutsideMousedown);
  }
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onCaptureKeydown, true);
  window.removeEventListener("mousedown", onOutsideMousedown);
});

function resetOne(action: HotkeyAction) {
  const result = hotkeys.reset(action.id);
  if (result.ok) {
    say(`${action.label} is back to its default.`);
    return;
  }
  // The default key a later rebind gave to another action.
  const taken = [action.defaults.primary, action.defaults.alternate].find(
    (key) => key !== null && result.reason === "conflict" && hotkeys.keys(result.conflictsWith).includes(key),
  );
  say(`Can't reset ${action.label}. ${describeBindingFailure(result, taken ?? action.defaults.primary)}`, true);
}

function resetAll() {
  hotkeys.resetAll();
  confirmingResetAll.value = false;
  say("Every hotkey is back to its default.");
}
</script>

<template>
  <div class="hotkeys">
    <div class="hotkeys-header">
      <span class="hotkeys-title">Hotkeys</span>
      <span class="hotkeys-hint">Choose the keys that feel natural. Tooltips and hints follow what you set.</span>
    </div>

    <p class="hotkeys-help">
      Click a key, then press the new one. <strong>Esc</strong> cancels, <strong>Backspace</strong> clears it. Plain keys
      only: no Ctrl, Cmd or Alt. Enter, Esc and Tab, and the arrow keys and Space inside answer boxes, never change.
    </p>

    <p v-if="message" class="hotkeys-message" :class="{ error: message.error }" role="status">{{ message.text }}</p>
    <p v-else class="hotkeys-message" role="status" />

    <section v-for="group in groups" :key="group.label" class="hotkeys-group" :aria-label="group.label">
      <h3 class="group-title">{{ group.label }}</h3>
      <ul class="action-list">
        <li v-for="action in group.actions" :key="action.id" class="action-row">
          <span class="action-label">{{ action.label }}</span>
          <div class="slots">
            <button
              v-for="entry in SLOTS"
              :key="entry.slot"
              type="button"
              class="key-btn"
              :class="{ capturing: isCapturing(action.id, entry.slot), unset: keyText(action.id, entry.slot) === null }"
              :aria-label="`${action.label}, ${entry.label.toLowerCase()} key: ${keyText(action.id, entry.slot) ?? 'not set'}. Press to change.`"
              @click="startCapture(action.id, entry.slot)"
            >
              <template v-if="isCapturing(action.id, entry.slot)">Press a key...</template>
              <template v-else>{{ keyText(action.id, entry.slot) ?? "Not set" }}</template>
            </button>
          </div>
          <button v-if="isChanged(action)" type="button" class="link" @click="resetOne(action)">Reset</button>
          <span v-else class="link-spacer" aria-hidden="true" />
        </li>
      </ul>
    </section>

    <div class="reset-all">
      <template v-if="confirmingResetAll">
        <span>Put every hotkey back to its default?</span>
        <button type="button" class="link danger" @click="resetAll">Reset all</button>
        <button type="button" class="link" @click="confirmingResetAll = false">Cancel</button>
      </template>
      <button v-else type="button" class="link" @click="confirmingResetAll = true">Reset all to defaults</button>
    </div>
  </div>
</template>

<style scoped>
.hotkeys {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}

.hotkeys-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.hotkeys-title {
  font-weight: 900;
  font-size: 15px;
}

.hotkeys-hint {
  font-size: 12px;
  color: var(--faint);
}

.hotkeys-help {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.hotkeys-message {
  min-height: 1.4em;
  margin: 0;
  color: var(--pass);
  font-size: 13px;
  font-weight: 700;
}

.hotkeys-message.error {
  color: var(--fail);
}

.group-title {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.action-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.action-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) auto 56px;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
}

.action-label {
  font-size: 14px;
  font-weight: 700;
}

.slots {
  display: flex;
  gap: 8px;
}

.key-btn {
  min-width: 96px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.key-btn.unset {
  color: var(--faint);
  font-weight: 400;
}

.key-btn.capturing {
  border-color: var(--accent);
  color: var(--accent);
}

.link {
  border: none;
  background: none;
  color: var(--accent-secondary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.link.danger {
  color: var(--fail);
}

.link-spacer {
  display: inline-block;
}

.reset-all {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

@media (max-width: 560px) {
  .action-row {
    grid-template-columns: 1fr auto;
  }

  .action-label {
    grid-column: 1 / -1;
  }
}
</style>
