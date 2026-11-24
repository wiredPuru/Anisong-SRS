<script setup lang="ts">
import type { PartyHostState } from "~/composables/usePartyHost";

const props = defineProps<{ state: PartyHostState }>();

const current = computed(() => props.state.queue[props.state.index] ?? null);
const answer = computed(() => current.value?.answer ?? null);
const rows = computed(() => songInfoRows(answer.value?.facts));
const showRomaji = computed(() => answer.value && answer.value.animeTitleRomaji !== answer.value.animeTitleEnglish);
const showNative = computed(
  () =>
    answer.value &&
    answer.value.animeTitleNative !== answer.value.animeTitleRomaji &&
    answer.value.animeTitleNative !== answer.value.animeTitleEnglish,
);
</script>

<template>
  <div class="song-info">
    <div class="si-chips">
      <span v-if="state.lightning" class="si-chip chip-lightning">Lightning: {{ state.lightning.mode }}</span>
      <span class="si-chip" :class="state.phase === 'revealed' ? 'chip-revealed' : 'chip-hidden'">
        {{ state.phase === "revealed" ? "Revealed" : "Hidden" }}
      </span>
    </div>

    <template v-if="current && answer">
      <div class="si-theme">
        <NetworkImage v-if="answer.coverImageUrl" class="si-cover" :src="answer.coverImageUrl" alt="" />
        <div class="si-theme-text">
          <p class="si-slot">{{ formatThemeSlotLabel(answer.themeSlot) }} · {{ current.kind === "audio" ? "Audio" : "Video" }}</p>
          <p class="si-song">{{ answer.songTitle }}</p>
          <p class="si-artist">
            by <PartyMainAppLink :path="artistLinkPath(current.artistId, answer.artistName)" :label="answer.artistName">{{
              answer.artistName
            }}</PartyMainAppLink>
          </p>
        </div>
      </div>

      <div class="si-titles">
        <p class="si-title">
          <PartyMainAppLink :path="animeCardsSearchPath(answer.animeTitleRomaji)" :label="answer.animeTitleEnglish">
            {{ answer.animeTitleEnglish }}
          </PartyMainAppLink>
        </p>
        <p v-if="showRomaji" class="si-alt">{{ answer.animeTitleRomaji }}</p>
        <p v-if="showNative" class="si-alt" lang="ja">{{ answer.animeTitleNative }}</p>
        <a
          v-if="current.aniListId !== null"
          class="si-anilist"
          :href="`https://anilist.co/anime/${current.aniListId}`"
          target="_blank"
          rel="noopener noreferrer"
        >View on AniList</a>
      </div>

      <dl v-if="rows.length" class="si-facts">
        <template v-for="row in rows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
    </template>
    <p v-else class="si-empty">The current song's answer shows here once a game starts.</p>
  </div>
</template>

<style scoped>
.song-info {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.song-info p {
  margin: 0;
}

.si-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.si-chip {
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 2px solid;
  font-size: 13px;
  font-weight: 700;
}

.chip-lightning {
  border-color: var(--accent);
  color: var(--accent);
  text-transform: capitalize;
}

.chip-hidden {
  border-color: var(--border);
  color: var(--muted);
}

.chip-revealed {
  border-color: var(--pass);
  color: var(--pass);
}

.si-theme {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.si-cover {
  flex-shrink: 0;
  width: 110px;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 2px solid var(--outline);
}

.si-theme-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.si-slot {
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}

.si-song {
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.25;
  color: var(--accent);
}

.si-artist {
  color: var(--muted);
}

.si-artist :deep(a) {
  color: var(--text);
}

.si-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.si-title {
  font-family: var(--font-display);
  font-size: 18px;
  line-height: 1.25;
}

.si-anilist {
  align-self: flex-start;
  margin-top: 4px;
  color: var(--accent-secondary);
  font-size: 13px;
  font-weight: 700;
}

.si-alt {
  color: var(--muted);
  font-size: 14px;
}

.si-facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  margin: 0;
  font-size: 14px;
}

.si-facts dt {
  color: var(--accent-secondary);
  font-weight: 700;
}

.si-facts dd {
  margin: 0;
  min-width: 0;
}

.si-empty {
  color: var(--muted);
}
</style>
