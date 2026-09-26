<script setup lang="ts">
interface CardRow {
  id: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  nextReviewAt: string;
  songTitle: string;
  themeSlot: string;
  artistName: string;
  animeTitleEnglish: string;
  animeCoverImageUrl: string | null;
}

const props = withDefaults(
  defineProps<{
    cards: CardRow[];
    selectedId: number | null;
    // Omitted, the checkbox column is not rendered at all.
    checkedIds?: Set<number>;
    showDue?: boolean;
  }>(),
  { checkedIds: undefined, showDue: true },
);

const emit = defineEmits<{
  select: [id: number];
  "check-click": [id: number, event: MouseEvent];
  "toggle-all": [];
}>();

const selectable = computed(() => props.checkedIds !== undefined);
const headerCheckState = computed(() =>
  props.checkedIds
    ? selectionState(
        props.checkedIds,
        props.cards.map((c) => c.id),
      )
    : "none",
);
</script>

<template>
  <div class="card-table" :class="{ selectable, 'no-due': !showDue }">
    <div class="row-line">
      <label v-if="selectable" class="row-check">
        <input
          type="checkbox"
          :checked="headerCheckState === 'all'"
          :indeterminate="headerCheckState === 'some'"
          aria-label="Select all loaded cards"
          @change="emit('toggle-all')"
        />
      </label>
      <div class="table-head">
        <span />
        <span>Song</span>
        <span class="col-anime">Anime</span>
        <span class="col-sources">Sources</span>
        <span v-if="showDue">Due</span>
      </div>
    </div>
    <div v-for="c in cards" :key="c.id" class="row-line">
      <label v-if="checkedIds" class="row-check">
        <input
          type="checkbox"
          :checked="checkedIds.has(c.id)"
          :aria-label="`Select ${c.songTitle}`"
          @click="emit('check-click', c.id, $event)"
        />
      </label>
      <button
        type="button"
        class="card-row"
        :class="{ selected: selectedId === c.id, checked: checkedIds?.has(c.id) }"
        :aria-pressed="selectedId === c.id"
        @click="emit('select', c.id)"
      >
        <img v-if="c.animeCoverImageUrl" :src="c.animeCoverImageUrl" alt="" class="cover-thumb" />
        <span v-else class="cover-thumb cover-thumb-empty" />
        <span class="cell-song">
          <span class="song-title">{{ c.songTitle }}</span>
          <span class="song-artist">{{ c.artistName }}</span>
        </span>
        <span class="cell-anime">
          {{ c.animeTitleEnglish }} <span class="slot">{{ c.themeSlot }}</span>
        </span>
        <span class="cell-sources">
          <span v-for="badge in compactSourceBadges(c)" :key="badge" class="badge">{{ badge }}</span>
          <span v-if="!compactSourceBadges(c).length" class="badge badge-none">No source</span>
        </span>
        <span v-if="showDue" class="cell-due" :class="{ 'due-now': isDueNow(c) }">{{ dueLabel(c) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Dense table: one grid line per card, actions demoted to the inspector.
   The same template-columns string is on the header row and every card row -
   keep them in step. */
.card-table {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.row-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.card-table.selectable .row-line {
  grid-template-columns: 22px minmax(0, 1fr);
}

.row-check {
  display: flex;
  justify-content: center;
  cursor: pointer;
}

.row-check input {
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
}

.table-head,
.card-row {
  display: grid;
  grid-template-columns: 46px 1fr 200px 140px 92px;
  gap: 14px;
  align-items: center;
}

.card-table.no-due .table-head,
.card-table.no-due .card-row {
  grid-template-columns: 46px 1fr 200px 140px;
}

.table-head {
  padding: 0 14px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--faint);
}

.card-row {
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid transparent;
  font-family: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.card-row:hover {
  border-color: var(--border);
}

.card-row.checked {
  background: color-mix(in srgb, var(--accent-secondary) 8%, var(--surface));
}

.card-row.selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, var(--bg));
}

.cover-thumb {
  width: 34px;
  height: 48px;
  border-radius: var(--radius-xs);
  object-fit: cover;
}

.cover-thumb-empty {
  display: block;
  background: var(--surface-raised);
}

.cell-song {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.song-title {
  font-size: 15px;
  font-weight: 700;
}

.song-artist,
.cell-anime {
  font-size: 13px;
  color: var(--muted);
}

.cell-anime .slot {
  color: var(--faint);
}

.cell-song > span,
.cell-anime {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-sources {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.cell-due {
  font-size: 13px;
  color: var(--muted);
}

.cell-due.due-now {
  color: var(--accent);
  font-weight: 700;
}

.badge {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-secondary);
  white-space: nowrap;
}

.badge-none {
  color: var(--fail);
  border-color: var(--fail);
}

/* 50h: drops the lower-priority columns at the app's one narrow breakpoint. */
@media (max-width: 820px) {
  .table-head,
  .card-row {
    grid-template-columns: 46px 1fr 92px;
  }

  .card-table.no-due .table-head,
  .card-table.no-due .card-row {
    grid-template-columns: 46px 1fr;
  }

  .cell-anime,
  .col-anime,
  .cell-sources,
  .col-sources {
    display: none;
  }
}
</style>
