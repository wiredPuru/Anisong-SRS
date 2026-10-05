<script setup lang="ts">
interface CardRow {
  id: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  suspended: boolean;
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
  }>(),
  { checkedIds: undefined },
);

const emit = defineEmits<{
  select: [id: number];
  "check-click": [id: number, event: MouseEvent];
  "toggle-all": [];
}>();

const { headRef, columnVars, dragging, onPointerDown, reset } = useCardColumns();

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
  <div class="card-table" :class="{ selectable, resizing: dragging }" :style="columnVars">
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
      <div ref="headRef" class="table-head">
        <span />
        <span class="col-song">Song</span>
        <span class="col-anime">
          Anime
          <span
            class="col-resizer"
            :class="{ dragging }"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize song and anime columns"
            @pointerdown="onPointerDown"
            @dblclick="reset"
          />
        </span>
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
          <span class="song-title" :title="c.songTitle">
            {{ c.songTitle }}
            <span v-if="c.suspended" class="badge badge-suspended">Suspended</span>
          </span>
          <span class="song-artist" :title="c.artistName">{{ c.artistName }}</span>
        </span>
        <span class="cell-anime" :title="`${c.animeTitleEnglish} ${formatThemeSlotLabel(c.themeSlot)}`">
          {{ c.animeTitleEnglish }} <span class="slot">{{ formatThemeSlotLabel(c.themeSlot) }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Dense table: one grid line per card, actions demoted to the inspector.
   The same template-columns string is on the header row and every card row -
   keep them in step. Sources and Due live in the inspector, not here, so the
   two text columns get all the width. */
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
  grid-template-columns: 46px minmax(0, var(--song-fr, 55fr)) minmax(0, var(--anime-fr, 45fr));
  gap: 14px;
  align-items: center;
}

.card-table.resizing {
  cursor: col-resize;
  user-select: none;
}

.table-head {
  padding: 0 14px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--faint);
}

.col-anime {
  position: relative;
}

/* Straddles the gap before the Anime header so the grid does not shift. Faint
   at rest so touch screens, which never hover, can still find it. */
.col-resizer {
  position: absolute;
  top: -6px;
  bottom: 2px;
  left: -16px;
  width: 18px;
  cursor: col-resize;
  touch-action: none;
}

.col-resizer::after {
  content: "";
  position: absolute;
  inset: 4px 8px;
  border-radius: var(--radius-pill);
  background: var(--border);
  transition: background 0.15s;
}

.col-resizer:hover::after,
.col-resizer.dragging::after {
  background: var(--accent);
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

.badge {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-secondary);
  white-space: nowrap;
}

.badge-suspended {
  margin-left: 6px;
  color: var(--muted);
  vertical-align: middle;
}
</style>
