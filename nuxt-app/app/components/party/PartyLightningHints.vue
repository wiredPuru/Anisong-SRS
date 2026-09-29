<script setup lang="ts">
import type { PartyHints } from "~/composables/usePartyDisplay";

defineProps<{ hints: NonNullable<PartyHints> }>();
</script>

<template>
  <div class="hints">
    <PartyLayoutFrame piece="hints">
      <PartyLightningHintsCard :hints="hints" />
    </PartyLayoutFrame>
  </div>
</template>

<style scoped>
.hints {
  position: absolute;
  inset: 0;
  background: var(--bg);
}
</style>
