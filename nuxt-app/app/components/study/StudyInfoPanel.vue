<script setup lang="ts">
defineProps<{
  songTitle: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  box: number;
}>();
</script>

<template>
  <div class="info-card">
    <div class="title-block">
      <span class="en">{{ animeTitleEnglish }}</span>
      <span class="romaji">{{ animeTitleRomaji }}</span>
    </div>

    <div class="song-block">
      <span class="label">Song</span>
      <span class="song-title">{{ songTitle }}</span>
    </div>

    <div class="meta-row">
      <div class="artist">
        <span class="label">Artist</span>
        <span class="name">{{ artistName }}</span>
      </div>
      <div class="box-badge">
        <span class="pill">Box {{ box }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.info-card {
  padding: 26px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-block .en {
  font-size: 27px;
  font-weight: 800;
}

.title-block .romaji {
  font-size: 16px;
  color: var(--muted);
  font-weight: 600;
}

.label {
  font-size: 12px;
  color: var(--faint);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.song-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.song-title {
  font-size: 18px;
  font-weight: 700;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.meta-row .artist {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-row .artist .name {
  font-size: 18px;
  font-weight: 700;
}

.box-badge .pill {
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent-secondary) 18%, var(--surface));
  border: 1px solid var(--accent-secondary);
  color: var(--accent-secondary);
  font-size: 12px;
  font-weight: 800;
}
</style>
