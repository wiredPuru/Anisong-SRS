<script setup lang="ts">
import { networkImageSrc } from "~/utils/networkImage";

const props = defineProps<{ src?: string | null }>();
const { offlineMode } = useNetworkMode();
const source = computed(() => networkImageSrc(props.src, offlineMode.value));
</script>

<template>
  <img v-if="source" :src="source" />
</template>
