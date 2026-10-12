<script setup lang="ts">
import { CARD_STATUS_LABELS, type CardStatus } from "../../utils/cardStatus";

defineProps<{ status: CardStatus }>();
</script>

<template>
  <span class="status-chip" :class="`status-${status}`">{{ CARD_STATUS_LABELS[status] }}</span>
</template>

<style scoped>
.status-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid currentColor;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  vertical-align: middle;
}

.status-new {
  color: var(--accent-secondary);
}

.status-learning {
  color: var(--accent);
}

.status-known {
  color: var(--pass);
}

.status-suspended {
  color: var(--muted);
}
</style>
