<script setup lang="ts">
defineProps<{
	deckName: string | null
	busy?: boolean
}>()
const emit = defineEmits<{
	'find-source': []
	bury: []
	'remove-from-deck': []
}>()
</script>

<template>
	<div class="trouble-actions">
		<button type="button" class="trouble-btn primary" :disabled="busy" @click="emit('find-source')">
			Find another source
		</button>
		<button type="button" class="trouble-btn" :disabled="busy" @click="emit('bury')">
			Skip for this session
		</button>
		<button v-if="deckName" type="button" class="trouble-btn danger" :disabled="busy" @click="emit('remove-from-deck')">
			Remove from {{ deckName }}
		</button>
	</div>
</template>

<style scoped>
.trouble-actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 8px;
	padding: 0 24px;
}

.trouble-btn {
	padding: 4px 12px;
	border-radius: var(--radius-pill);
	border: 1px solid var(--accent-secondary);
	background: transparent;
	color: var(--accent-secondary);
	font-family: var(--font-sans);
	font-size: 13px;
	font-weight: 700;
	cursor: pointer;
}

.trouble-btn.primary {
	border-color: var(--accent);
	color: var(--accent);
}

.trouble-btn.danger {
	border-color: var(--fail);
	color: var(--fail);
}

.trouble-btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}
</style>
