<script setup lang="ts">
const { enabled, refresh, setEnabled } = useAmbientPreference();
onMounted(refresh);
</script>

<template>
  <div class="ambient-toggle">
    <label class="ambient-label">
      <input
        type="checkbox"
        :checked="enabled"
        @change="setEnabled(($event.target as HTMLInputElement).checked)"
      />
      Ambient mode
    </label>
  </div>
</template>

<style scoped>
.ambient-toggle {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}

.ambient-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.ambient-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}
</style>
