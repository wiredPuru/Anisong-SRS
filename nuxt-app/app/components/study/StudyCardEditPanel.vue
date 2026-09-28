<script setup lang="ts">
interface CardWithDetails {
	id: number
	localVideoPath: string | null
	localAudioPath: string | null
	animethemesVideoUrl: string | null
	animethemesAudioUrl: string | null
	notes: string | null
}

interface ManualDeck {
	id: number
	name: string
}

const props = defineProps<{
	card: CardWithDetails
	manualDecks: ManualDeck[]
	memberships: Record<number, number[]>
	togglingMembership: Record<string, boolean>
	deckToggleError: string | null
	hasDefaultDownloadFolder: boolean
	disabled?: boolean
}>()
const emit = defineEmits<{
	updated: [card: CardWithDetails]
	'editing-change': [editing: boolean]
	'toggle-membership': [deckId: number, checked: boolean]
	deleted: [cardId: number]
	buried: [cardId: number]
}>()

const editing = ref(false)
watch(editing, (value) => emit('editing-change', value), { flush: 'sync' })
const videoPath = ref('')
const audioPath = ref('')
const notes = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const clearing = reactive<Record<string, boolean>>({})

function startEdit() {
	if (props.disabled) return
	videoPath.value = props.card.localVideoPath ?? ''
	audioPath.value = props.card.localAudioPath ?? ''
	notes.value = props.card.notes ?? ''
	error.value = null
	editing.value = true
}

function cancelEdit() {
	editing.value = false
	error.value = null
	confirmingDelete.value = false
	deleteError.value = null
}

// Study's E hotkey. Closing drops unsaved edits, the same as Cancel.
function toggle() {
	if (editing.value) cancelEdit()
	else startEdit()
}
defineExpose({ toggle })

const confirmingDelete = ref(false)
const deleting = ref(false)
const deleteError = ref<string | null>(null)
const deleteConfirmRef = ref<HTMLElement | null>(null)

// The form sits in a scrolling column, so the confirm opens below the fold.
async function askDelete() {
	confirmingDelete.value = true
	await nextTick()
	deleteConfirmRef.value?.scrollIntoView({ block: 'nearest' })
}

async function deleteCard() {
	deleteError.value = null
	deleting.value = true
	try {
		await $fetch('/api/cards', { method: 'DELETE', body: { id: props.card.id } })
		emit('deleted', props.card.id)
	} catch (err) {
		deleteError.value = extractErrorMessage(err, 'Failed to delete card.')
		confirmingDelete.value = false
	} finally {
		deleting.value = false
	}
}

async function save() {
	error.value = null
	saving.value = true
	try {
		const result = await $fetch<{ card: CardWithDetails }>('/api/cards', {
			method: 'PATCH',
			body: {
				id: props.card.id,
				localVideoPath:
					videoPath.value.trim() === ''
						? null
						: videoPath.value.trim(),
				localAudioPath:
					audioPath.value.trim() === ''
						? null
						: audioPath.value.trim(),
				notes: notes.value.trim() === '' ? null : notes.value.trim(),
			},
		})
		editing.value = false
		emit('updated', result.card)
	} catch (err) {
		error.value = extractErrorMessage(err, 'Failed to update card.')
	} finally {
		saving.value = false
	}
}

async function clearLocalPath(kind: 'video' | 'audio') {
	error.value = null
	clearing[kind] = true
	try {
		const body =
			kind === 'video'
				? { id: props.card.id, localVideoPath: null }
				: { id: props.card.id, localAudioPath: null }
		const result = await $fetch<{ card: CardWithDetails }>('/api/cards', {
			method: 'PATCH',
			body,
		})
		if (kind === 'video') videoPath.value = ''
		else audioPath.value = ''
		emit('updated', result.card)
	} catch (err) {
		error.value = extractErrorMessage(err, 'Failed to clear local file.')
	} finally {
		clearing[kind] = false
	}
}

const {
	downloading,
	downloadProgress,
	downloadError,
	downloadKey,
	canDownload,
	downloadMedia,
} = useCardDownloads()

async function downloadLocalPath(kind: 'video' | 'audio') {
	const result = await downloadMedia<CardWithDetails>(
		props.card.id,
		props.card.id,
		kind,
	)
	if (!result) return
	if (kind === 'video') videoPath.value = result.localVideoPath ?? ''
	else audioPath.value = result.localAudioPath ?? ''
	emit('updated', result)
}
</script>

<template>
	<div class="card-edit-panel">
		<button
			v-if="!editing"
			type="button"
			class="edit-toggle-btn"
			:disabled="disabled"
			@click="startEdit"
		>
			Edit card
			<span class="tooltip">Hotkey: E</span>
		</button>
		<form v-else class="edit-form" @submit.prevent="save">
			<div class="skip-actions">
				<button
					type="button"
					class="bury-btn"
					:disabled="saving || deleting"
					@click="emit('buried', card.id)"
				>
					Bury for this session
				</button>
				<button
					v-if="!confirmingDelete"
					type="button"
					class="delete-btn"
					:disabled="saving || deleting"
					@click="askDelete"
				>
					Delete
				</button>
			</div>
			<div
				v-if="confirmingDelete"
				ref="deleteConfirmRef"
				class="delete-confirm"
				role="alert"
			>
				<span class="confirm-label">
					Delete this card from your library? This also removes its
					downloaded files.
				</span>
				<div class="edit-actions">
					<button
						type="button"
						class="delete-confirm-btn"
						:disabled="deleting"
						@click="deleteCard"
					>
						{{ deleting ? 'Deleting...' : 'Confirm' }}
					</button>
					<button
						type="button"
						class="cancel-btn"
						:disabled="deleting"
						@click="confirmingDelete = false"
					>
						Keep it
					</button>
				</div>
			</div>
			<p v-if="deleteError" class="edit-error">{{ deleteError }}</p>
			<label class="field">
				<span class="field-label">Local video path</span>
				<div class="path-row">
					<input
						v-model="videoPath"
						type="text"
						placeholder="Blank to clear"
						:disabled="saving"
					/>
					<button
						v-if="card.localVideoPath"
						type="button"
						class="clear-btn"
						:disabled="saving || clearing.video"
						@click="clearLocalPath('video')"
					>
						{{ clearing.video ? 'Clearing...' : 'Clear' }}
					</button>
					<button
						v-else-if="
							canDownload(card, 'video') &&
							hasDefaultDownloadFolder
						"
						type="button"
						class="download-btn"
						:disabled="
							saving || downloading[downloadKey(card.id, 'video')]
						"
						@click="downloadLocalPath('video')"
					>
						{{
							downloading[downloadKey(card.id, 'video')]
								? formatDownloadProgress(
										downloadProgress[
											downloadKey(card.id, 'video')
										],
									)
								: 'Download'
						}}
					</button>
					<NuxtLink
						v-else-if="canDownload(card, 'video')"
						to="/settings"
						class="download-hint-inline"
					>
						Set download folder
					</NuxtLink>
				</div>
			</label>
			<label class="field">
				<span class="field-label">Local audio path</span>
				<div class="path-row">
					<input
						v-model="audioPath"
						type="text"
						placeholder="Blank to clear"
						:disabled="saving"
					/>
					<button
						v-if="card.localAudioPath"
						type="button"
						class="clear-btn"
						:disabled="saving || clearing.audio"
						@click="clearLocalPath('audio')"
					>
						{{ clearing.audio ? 'Clearing...' : 'Clear' }}
					</button>
					<button
						v-else-if="
							canDownload(card, 'audio') &&
							hasDefaultDownloadFolder
						"
						type="button"
						class="download-btn"
						:disabled="
							saving || downloading[downloadKey(card.id, 'audio')]
						"
						@click="downloadLocalPath('audio')"
					>
						{{
							downloading[downloadKey(card.id, 'audio')]
								? formatDownloadProgress(
										downloadProgress[
											downloadKey(card.id, 'audio')
										],
									)
								: 'Download'
						}}
					</button>
					<NuxtLink
						v-else-if="canDownload(card, 'audio')"
						to="/settings"
						class="download-hint-inline"
					>
						Set download folder
					</NuxtLink>
				</div>
			</label>
			<p v-if="downloadError[card.id]" class="edit-error">
				{{ downloadError[card.id] }}
			</p>

			<label class="field">
				<span class="field-label">Notes</span>
				<textarea
					v-model="notes"
					rows="3"
					placeholder="A memory hook for this card"
					:disabled="saving"
				/>
			</label>

			<div class="field">
				<span class="field-label">Decks</span>
				<DeckMembershipPanel
					:card-id="card.id"
					:decks="manualDecks"
					:memberships="memberships"
					:toggling="togglingMembership"
					:error="deckToggleError"
					@toggle="
						(deckId, checked) =>
							emit('toggle-membership', deckId, checked)
					"
				/>
			</div>

			<p v-if="error" class="edit-error">{{ error }}</p>

			<div class="edit-actions">
				<button type="submit" class="save-btn" :disabled="saving || deleting">
					Save
				</button>
				<button
					type="button"
					class="cancel-btn"
					:disabled="saving || deleting"
					@click="cancelEdit"
				>
					Cancel
				</button>
			</div>
		</form>
	</div>
</template>

<style scoped>
.card-edit-panel {
	display: flex;
	flex-direction: column;
}

.edit-toggle-btn {
	position: relative;
	align-self: flex-start;
	padding: 8px 18px;
	border-radius: var(--radius-pill);
	border: 1px solid var(--accent);
	background: transparent;
	color: var(--accent);
	font-family: var(--font-sans);
	font-weight: 700;
	cursor: pointer;
}

.tooltip {
	position: absolute;
	top: calc(100% + 8px);
	left: 50%;
	transform: translateX(-50%);
	padding: 4px 10px;
	border-radius: var(--radius-sm);
	background: var(--surface-raised);
	border: 1px solid var(--border);
	color: var(--text);
	font-size: 12px;
	font-weight: 700;
	white-space: nowrap;
	opacity: 0;
	visibility: hidden;
	pointer-events: none;
	transition: opacity 0.15s ease;
	z-index: 5;
}

.edit-toggle-btn:hover .tooltip,
.edit-toggle-btn:focus-visible .tooltip {
	opacity: 1;
	visibility: visible;
}

.edit-form {
	display: flex;
	flex-direction: column;
	gap: 14px;
	padding: 18px;
	border-radius: var(--radius-sm);
	background: var(--surface);
	border: 1px solid var(--border);
}

.field {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.field-label {
	font-size: 12px;
	color: var(--faint);
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.5px;
}

.field input[type='text'] {
	padding: 8px 12px;
	border-radius: var(--radius-sm);
	border: 1px solid var(--border);
	background: var(--surface-raised);
	color: var(--text);
	font-family: var(--font-sans);
	font-size: 14px;
}

.field input[type='text']:focus {
	outline: none;
	border-color: var(--accent);
	box-shadow: var(--shadow-accent);
}

.field textarea {
	padding: 8px 12px;
	border-radius: var(--radius-sm);
	border: 1px solid var(--border);
	background: var(--surface-raised);
	color: var(--text);
	font-family: var(--font-sans);
	font-size: 14px;
	resize: vertical;
}

.field textarea:focus {
	outline: none;
	border-color: var(--accent);
	box-shadow: var(--shadow-accent);
}

.path-row {
	display: flex;
	align-items: center;
	gap: 8px;
}

.path-row input[type='text'] {
	flex: 1;
	min-width: 0;
}

.clear-btn {
	flex: none;
	padding: 6px 12px;
	border-radius: var(--radius-pill);
	border: 1px solid var(--fail);
	background: transparent;
	color: var(--fail);
	font-family: var(--font-sans);
	font-size: 13px;
	font-weight: 700;
	cursor: pointer;
}

.clear-btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.download-btn {
	flex: none;
	padding: 6px 12px;
	border-radius: var(--radius-pill);
	border: 1px solid var(--accent-secondary);
	background: transparent;
	color: var(--accent-secondary);
	font-family: var(--font-sans);
	font-size: 13px;
	font-weight: 700;
	cursor: pointer;
}

.download-btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.download-hint-inline {
	flex: none;
	font-size: 12px;
	color: var(--muted);
	white-space: nowrap;
}

.edit-actions {
	display: flex;
	gap: 8px;
}

.save-btn {
	padding: 8px 18px;
	border-radius: var(--radius-pill);
	border: 1px solid var(--accent);
	background: transparent;
	color: var(--accent);
	font-family: var(--font-sans);
	font-weight: 700;
	cursor: pointer;
}

.cancel-btn {
	padding: 8px 18px;
	border-radius: var(--radius-pill);
	border: 1px solid var(--fail);
	background: transparent;
	color: var(--fail);
	font-family: var(--font-sans);
	font-weight: 700;
	cursor: pointer;
}

.skip-actions {
	display: flex;
	gap: 8px;
	padding-bottom: 10px;
	border-bottom: 1px solid var(--border);
}

.bury-btn,
.delete-btn {
	padding: 6px 14px;
	border-radius: var(--radius-pill);
	background: transparent;
	font-family: var(--font-sans);
	font-weight: 700;
	font-size: 13px;
	cursor: pointer;
}

.bury-btn {
	border: 1px solid var(--accent-secondary);
	color: var(--accent-secondary);
}

.delete-btn {
	border: 1px solid var(--fail);
	color: var(--fail);
}

.delete-confirm {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 10px 12px;
	border-radius: var(--radius-sm);
	border: 1px solid var(--fail);
}

.confirm-label {
	font-size: 13px;
	color: var(--text);
}

.delete-confirm-btn {
	padding: 8px 18px;
	border-radius: var(--radius-pill);
	border: 1px solid var(--fail);
	background: var(--fail);
	color: var(--bg);
	font-family: var(--font-sans);
	font-weight: 700;
	cursor: pointer;
}

.save-btn:disabled,
.cancel-btn:disabled,
.bury-btn:disabled,
.delete-btn:disabled,
.delete-confirm-btn:disabled,
.edit-toggle-btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.edit-error {
	margin: 0;
	color: var(--fail);
	font-size: 13px;
}
</style>
