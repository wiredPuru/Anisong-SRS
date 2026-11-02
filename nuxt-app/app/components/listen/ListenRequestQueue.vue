<script setup lang="ts">
import { listenCard, type ListenQueueEntry } from "~/utils/listenRequests";
import { formatThemeSlotLabel } from "~/utils/themeSlotAnswer";

const props = defineProps<{ entries: ListenQueueEntry[] }>();
const emit = defineEmits<{ remove: [entryId: number]; clear: [] }>();
const rows = computed(() => props.entries.map((entry) => ({ entry, card: listenCard(entry) })));
</script>

<template>
  <section class="request-queue" aria-labelledby="listen-queue-title">
    <header>
      <h3 id="listen-queue-title">Up next <span>{{ entries.length }}</span></h3>
      <button v-if="entries.length" type="button" class="clear-btn" @click="emit('clear')">Clear requests</button>
    </header>
    <p v-if="!entries.length" class="hint">No requested songs. Your deck plays normally.</p>
    <template v-else>
      <ol>
        <li v-for="row in rows" :key="row.entry.entryId">
          <div class="song-copy">
            <strong>{{ row.card.songTitle }}</strong>
            <span>{{ row.card.artistName }} &middot; {{ row.card.animeTitleRomaji }} &middot; {{ formatThemeSlotLabel(row.card.themeSlot) }}</span>
          </div>
          <button type="button" :aria-label="`Remove ${row.card.songTitle} from queue`" @click="emit('remove', row.entry.entryId)">Remove</button>
        </li>
      </ol>
      <p class="hint">Then your deck continues in its current order.</p>
    </template>
  </section>
</template>

<style scoped>
.request-queue { padding: 1rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); margin-bottom: 1.25rem; }
header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; }
h3, p { margin: 0; }
h3 { font-size: 0.95rem; }
h3 span { color: var(--muted); font-variant-numeric: tabular-nums; margin-left: 0.3rem; }
.hint { font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem; }
ol { max-height: 13rem; overflow: auto; padding-left: 1.5rem; margin: 0.5rem 0; }
li { padding: 0.5rem 0; border-top: 1px solid var(--border); }
li::marker { color: var(--faint); }
.song-copy { display: inline-grid; vertical-align: middle; width: calc(100% - 5rem); padding-right: 0.5rem; overflow-wrap: anywhere; }
.song-copy strong { font-size: 0.85rem; }
.song-copy span { color: var(--muted); font-size: 0.75rem; }
button { padding: 0.4rem 0.65rem; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface-raised); color: var(--text); font: inherit; font-size: 0.75rem; cursor: pointer; }
</style>
