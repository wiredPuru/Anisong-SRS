<script setup lang="ts">
import type { PartyHostState } from "~/composables/usePartyHost";
import { rankCommands } from "~/utils/fuzzyMatch";
import { PARTY_PALETTE_COMMANDS, paletteCommandById, type PaletteLocal, type PartyPaletteCommand } from "~/utils/partyPalette";

const RESULT_LIMIT = 12;

const props = defineProps<{ state: PartyHostState | null; local: PaletteLocal; recent: readonly string[] }>();
const emit = defineEmits<{ pick: [command: PartyPaletteCommand]; close: [] }>();

const query = ref("");
const active = ref(0);
const input = ref<HTMLInputElement | null>(null);

interface RowView {
  command: PartyPaletteCommand;
  optionId: string;
  heading: string | null;
  reason: string | null;
  on: boolean | null;
}

function reasonFor(command: PartyPaletteCommand): string | null {
  if (command.local) return null;
  if (!props.state) return "Connecting...";
  return command.available?.(props.state) ?? null;
}

const rows = computed<RowView[]>(() => {
  let picked: { command: PartyPaletteCommand; heading: string | null }[];
  if (query.value.trim()) {
    picked = rankCommands(query.value, PARTY_PALETTE_COMMANDS, RESULT_LIMIT).map((match) => ({ command: match.item, heading: null }));
  } else {
    const recent = props.recent.map(paletteCommandById).filter((command): command is PartyPaletteCommand => command !== null);
    const rest = PARTY_PALETTE_COMMANDS.filter((command) => !recent.includes(command));
    picked = [
      ...recent.map((command, i) => ({ command, heading: i === 0 ? "Recent" : null })),
      ...rest.map((command, i) => ({ command, heading: i === 0 && recent.length ? "All commands" : null })),
    ].slice(0, RESULT_LIMIT);
  }
  return picked.map(({ command, heading }) => ({
    command,
    heading,
    optionId: `palette-opt-${command.id}`,
    reason: reasonFor(command),
    on: command.kind === "toggle" && props.state && command.state ? command.state(props.state, props.local) : null,
  }));
});

const activeId = computed(() => rows.value[active.value]?.optionId);

watch(query, () => {
  active.value = 0;
});

watch(active, async (index) => {
  await nextTick();
  const id = rows.value[index]?.optionId;
  if (id) document.getElementById(id)?.scrollIntoView({ block: "nearest" });
});

function pick(row: RowView | undefined) {
  if (!row || row.reason) return;
  emit("pick", row.command);
}

function move(step: number) {
  const count = rows.value.length;
  if (count) active.value = (active.value + step + count) % count;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") move(1);
  else if (event.key === "ArrowUp") move(-1);
  else if (event.key === "Enter") pick(rows.value[active.value]);
  else if (event.key === "Escape") emit("close");
  // Focus stays in the box; Tab has nowhere else to go.
  else if (event.key !== "Tab") return;
  event.preventDefault();
  // Esc and the arrows must not also reach another dialog or the hotkeys.
  event.stopPropagation();
}

onMounted(() => input.value?.focus());
</script>

<template>
  <div class="cmd-backdrop" @click.self="emit('close')">
    <div class="cmd-panel" role="dialog" aria-modal="true" aria-label="Command bar">
      <input
        ref="input"
        v-model="query"
        class="cmd-input"
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-list"
        aria-autocomplete="list"
        :aria-activedescendant="activeId"
        placeholder="Type a command or a panel"
        autocomplete="off"
        spellcheck="false"
        @keydown="onKeydown"
      />
      <ul id="palette-list" class="cmd-list" role="listbox" aria-label="Commands">
        <template v-for="(row, i) in rows" :key="row.command.id">
          <li v-if="row.heading" class="cmd-heading" role="presentation">{{ row.heading }}</li>
          <li
            :id="row.optionId"
            class="cmd-row"
            :class="{ active: i === active, disabled: row.reason }"
            role="option"
            :aria-selected="i === active"
            :aria-disabled="Boolean(row.reason)"
            @mousemove="active = i"
            @mousedown.prevent
            @click="pick(row)"
          >
            <span class="cmd-text">
              <span class="cmd-title">{{ row.command.title }}</span>
              <span v-if="row.reason" class="cmd-reason">{{ row.reason }}</span>
            </span>
            <span class="cmd-group">{{ row.command.group }}</span>
            <span v-if="row.on !== null" class="cmd-chip" :class="{ on: row.on }">{{ row.on ? "On" : "Off" }}</span>
            <kbd v-if="row.command.hotkey" class="cmd-key">{{ row.command.hotkey }}</kbd>
          </li>
        </template>
        <li v-if="!rows.length" class="cmd-empty" role="presentation">No commands match</li>
      </ul>
      <p class="cmd-footer" aria-hidden="true">↑↓ to pick · Enter to run · Esc to close</p>
    </div>
  </div>
</template>

<style scoped>
.cmd-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-above-immersive);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 16px 16px;
  background: var(--scrim);
}

.cmd-panel {
  width: min(560px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  border: 2px solid var(--outline);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

.cmd-input {
  margin: 12px;
  padding: 10px 14px;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
}

.cmd-input:focus {
  outline: none;
  border-color: var(--accent);
}

.cmd-list {
  margin: 0;
  padding: 0 8px 8px;
  list-style: none;
  overflow-y: auto;
}

.cmd-heading {
  padding: 8px 8px 4px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cmd-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.cmd-row.active {
  background: var(--surface-raised);
  box-shadow: inset 3px 0 0 var(--accent);
}

.cmd-row.disabled {
  cursor: default;
}

.cmd-row.disabled .cmd-title {
  color: var(--faint);
}

.cmd-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.cmd-title {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cmd-reason {
  color: var(--muted);
  font-size: 12px;
}

.cmd-group {
  color: var(--muted);
  font-size: 12px;
}

.cmd-chip {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.cmd-chip.on {
  border-color: var(--pass);
  background: var(--pass);
  color: var(--pass-ink);
}

.cmd-empty {
  padding: 16px 10px;
  color: var(--muted);
  text-align: center;
}

.cmd-footer {
  margin: 0;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
}

.cmd-key {
  min-width: 26px;
  padding: 1px 7px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  background: var(--surface-sunken);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

@media (max-width: 600px) {
  .cmd-backdrop {
    padding-top: 16px;
  }

  .cmd-group {
    display: none;
  }
}
</style>
