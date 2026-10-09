<script setup lang="ts">
interface CardWithDetails {
	id: number
	songTitle: string
	animeAniListId: number
	animeTitleRomaji: string
}

interface SourceCandidate {
	resultKey: string
	provider: 'anisongdb' | 'animethemes'
	songTitle: string | null
	artistName: string | null
	themeSlot: string
	animeTitle: string
	sameAnime: boolean
	videoUrl: string | null
	audioUrl: string | null
	clipBlocked: boolean
}

const props = defineProps<{
	open: boolean
	card: CardWithDetails
}>()
const emit = defineEmits<{
	close: []
	applied: [card: CardWithDetails]
}>()

const query = ref('')
const results = ref<SourceCandidate[]>([])
const searching = ref(false)
const searched = ref(false)
const searchError = ref<string | null>(null)
const applyingKey = ref<string | null>(null)
const applyError = ref<string | null>(null)
let searchSeq = 0

async function search() {
	const q = query.value.trim()
	if (!q) return
	const seq = ++searchSeq
	searching.value = true
	searchError.value = null
	applyError.value = null
	try {
		const response = await $fetch<{ results: SourceCandidate[] }>('/api/cards/source-search', {
			query: { q, animeAniListId: props.card.animeAniListId },
		})
		if (seq !== searchSeq) return
		results.value = response.results
		searched.value = true
	} catch (err) {
		if (seq !== searchSeq) return
		searchError.value = extractErrorMessage(err, "Couldn't search for another source.")
	} finally {
		if (seq === searchSeq) searching.value = false
	}
}

async function apply(candidate: SourceCandidate) {
	applyingKey.value = candidate.resultKey
	applyError.value = null
	try {
		const response = await $fetch<{ card: CardWithDetails }>('/api/cards/source', {
			method: 'POST',
			body: { cardId: props.card.id, videoUrl: candidate.videoUrl, audioUrl: candidate.audioUrl },
		})
		emit('applied', response.card)
	} catch (err) {
		applyError.value = extractErrorMessage(err, "Couldn't use that source.")
	} finally {
		applyingKey.value = null
	}
}

// Providers disagree on version suffixes ("Go Nin Ver." vs "5-nin Ver."), so a
// first search that finds nothing usable retries on the title before the "(".
async function searchWithShortenedFallback() {
	await search()
	if (results.value.some((candidate) => !candidate.clipBlocked)) return
	const shortened = props.card.songTitle.split('(')[0]?.trim()
	if (!shortened || shortened === query.value.trim()) return
	query.value = shortened
	await search()
}

function providerLabel(candidate: SourceCandidate) {
	return candidate.provider === 'anisongdb' ? 'AnisongDB' : 'AnimeThemes.moe'
}

function kindsLabel(candidate: SourceCandidate) {
	return [candidate.videoUrl && 'video', candidate.audioUrl && 'audio'].filter(Boolean).join(' + ')
}

watch(
	() => props.open,
	(open) => {
		if (!open) return
		query.value = props.card.songTitle
		results.value = []
		searched.value = false
		searchError.value = null
		applyError.value = null
		void searchWithShortenedFallback()
	},
	{ immediate: true },
)

function onKeydown(event: KeyboardEvent) {
	if (!props.open) return
	if (event.key === 'Escape') {
		event.stopPropagation()
		emit('close')
	}
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onUnmounted(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
	<div v-if="open" class="backdrop" @click.self="emit('close')">
		<div class="panel" role="dialog" aria-label="Find another source">
			<button type="button" class="close-btn" aria-label="Close" @click="emit('close')">✕</button>
			<h2 class="title">Find another source</h2>
			<p class="hint">
				Searches AnisongDB and AnimeThemes.moe. Picking a result swaps this card's clip links only; its song, anime and
				schedule stay as they are.
			</p>
			<form class="search-row" @submit.prevent="search">
				<input v-model="query" type="text" placeholder="Song title" :disabled="searching" />
				<button type="submit" class="action-btn" :disabled="searching || !query.trim()">
					{{ searching ? 'Searching...' : 'Search' }}
				</button>
			</form>
			<p v-if="searchError" class="error" role="alert">{{ searchError }}</p>
			<p v-else-if="searched && results.length === 0" class="hint">No clips found for that search. Try the anime or artist name.</p>
			<p v-if="applyError" class="error" role="alert">{{ applyError }}</p>
			<ul v-if="results.length" class="result-list">
				<li v-for="candidate in results" :key="candidate.resultKey">
					<div class="result-info">
						<span class="result-song">{{ candidate.songTitle ?? 'Unknown song' }}</span>
						<span class="result-meta">
							{{ candidate.animeTitle }} &middot; {{ candidate.themeSlot }}<template v-if="candidate.artistName">
								&middot; {{ candidate.artistName }}</template>
						</span>
						<span class="result-meta">
							<span v-if="candidate.sameAnime" class="chip same">Same anime</span>
							<span class="chip">{{ providerLabel(candidate) }}</span>
							<span v-if="!candidate.clipBlocked" class="chip">{{ kindsLabel(candidate) }}</span>
						</span>
					</div>
					<button
						v-if="!candidate.clipBlocked"
						type="button"
						class="action-btn"
						:disabled="applyingKey !== null"
						@click="apply(candidate)"
					>
						{{ applyingKey === candidate.resultKey ? 'Using...' : 'Use this' }}
					</button>
					<NuxtLink v-else to="/settings?section=playback" class="blocked-note">
						Blocked by Clip source setting
					</NuxtLink>
				</li>
			</ul>
		</div>
	</div>
</template>

<style scoped>
.backdrop {
	position: fixed;
	inset: 0;
	background: var(--scrim);
	backdrop-filter: blur(4px);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 24px;
	z-index: var(--z-above-immersive);
}

.panel {
	position: relative;
	width: 100%;
	max-width: 560px;
	max-height: min(680px, 85vh);
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 28px;
	border-radius: calc(var(--radius) + 8px);
	background: var(--bg);
	border: 1px solid var(--outline);
	box-shadow: var(--shadow-soft);
}

.close-btn {
	position: absolute;
	top: 16px;
	right: 16px;
	width: 36px;
	height: 36px;
	border-radius: 50%;
	border: 1px solid var(--border);
	background: var(--surface-raised);
	color: var(--text);
	font-size: 16px;
	cursor: pointer;
}

.title {
	margin: 0;
	padding-right: 36px;
	font-size: 18px;
	font-weight: 800;
	color: var(--text);
}

.hint {
	margin: 0;
	font-size: 13px;
	color: var(--muted);
}

.search-row {
	display: flex;
	gap: 8px;
}

.search-row input {
	flex: 1;
	min-width: 0;
	padding: 8px 12px;
	border-radius: var(--radius-sm);
	border: 1px solid var(--border);
	background: var(--surface-raised);
	color: var(--text);
	font-family: var(--font-sans);
	font-size: 14px;
}

.action-btn {
	flex: none;
	padding: 6px 14px;
	border-radius: var(--radius-pill);
	border: 1px solid var(--accent);
	background: transparent;
	color: var(--accent);
	font-family: var(--font-sans);
	font-size: 13px;
	font-weight: 700;
	cursor: pointer;
}

.action-btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.error {
	margin: 0;
	color: var(--fail);
	font-size: 13px;
}

.result-list {
	list-style: none;
	margin: 0;
	padding: 0;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.result-list li {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 12px;
	border-radius: var(--radius-sm);
	border: 1px solid var(--border);
	background: var(--surface);
}

.result-info {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.result-song {
	font-weight: 700;
	color: var(--text);
}

.result-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	font-size: 12px;
	color: var(--muted);
}

.chip {
	padding: 1px 8px;
	border-radius: var(--radius-pill);
	border: 1px solid var(--border);
	font-size: 11px;
	font-weight: 700;
}

.chip.same {
	border-color: var(--accent-secondary);
	color: var(--accent-secondary);
}

.blocked-note {
	flex: none;
	max-width: 130px;
	font-size: 12px;
	text-align: right;
	color: var(--muted);
}
</style>
