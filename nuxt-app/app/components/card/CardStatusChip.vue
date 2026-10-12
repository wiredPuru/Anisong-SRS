<script setup lang="ts">
import { CARD_STATUS_LABELS, type CardStatus } from "../../utils/cardStatus";

defineProps<{ status: CardStatus }>();
</script>

<template>
  <span class="status-chip" :class="`status-${status}`">{{ CARD_STATUS_LABELS[status] }}</span>
</template>

<style scoped>
.status-chip {
  align-self: flex-start;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
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
