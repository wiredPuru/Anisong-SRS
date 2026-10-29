<script setup lang="ts">
import type { CardWithDetails } from "~/composables/useStudySession";
import type { ListenPlayerPort, ListenSlot } from "~/composables/useListenPlayback";
import type { ManagedPlaybackSnapshot } from "~/utils/managedPlayback";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  card: CardWithDetails;
  presentationKey: number;
  managedMode: boolean;
  slots: ListenSlot[];
  tailHideVideo?: boolean;
  tailHideCover?: boolean;
}>();
const emit = defineEmits<{
  "attach": [id: number, port: ListenPlayerPort];
  "report": [id: number, snapshot: ManagedPlaybackSnapshot];
  "local-path-updated": [{ cardId: number; kind: "video" | "audio"; localPath: string }];
  "local-path-cleared": [{ cardId: number; kind: "video" | "audio" }];
  "update:media-kind": ["video" | "audio"];
}>();

// One master volume for both slots; the saved level is only written by the
// foreground player's own slider, never by a temporary fade.
const VOLUME_STORAGE_KEY = "gaqSrs:playerVolume";
const masterVolume = ref(1);
onMounted(() => {
  try {
    const stored = Number(localStorage.getItem(VOLUME_STORAGE_KEY));
    if (Number.isFinite(stored) && stored >= 0 && stored <= 1) masterVolume.value = stored;
  } catch {
    // Storage can be unavailable; full volume for this visit.
  }
});

function bindPort(slot: ListenSlot, instance: unknown) {
  if (instance) emit("attach", slot.id, instance as ListenPlayerPort);
}

// The outgoing slot keeps the veil state it had when it left the foreground.
const attrs = useAttrs();
function veil(slot: ListenSlot, name: "hideVideo" | "hideCover") {
  if (slot.role === "tail") return name === "hideVideo" ? props.tailHideVideo : props.tailHideCover;
  const kebab = name === "hideVideo" ? "hide-video" : "hide-cover";
  return Boolean(attrs[kebab] ?? attrs[name]);
}

function adopt(slot: ListenSlot) {
  return slot.role === "foreground";
}
</script>

<template>
  <StudyMediaPlayer
    v-if="!managedMode"
    :key="presentationKey"
    v-bind="$attrs"
    :card="card"
    @local-path-updated="emit('local-path-updated', { cardId: card.id, ...$event })"
    @local-path-cleared="emit('local-path-cleared', { cardId: card.id, ...$event })"
    @update:media-kind="emit('update:media-kind', $event)"
  >
    <template #error-actions><slot name="error-actions" /></template>
  </StudyMediaPlayer>
  <div v-else class="mix-stack">
    <StudyMediaPlayer
      v-for="slot in slots"
      :key="slot.id"
      :ref="(instance: unknown) => bindPort(slot, instance)"
      v-bind="$attrs"
      :card="slot.card"
      :hide-video="veil(slot, 'hideVideo')"
      :hide-cover="veil(slot, 'hideCover')"
      :ghost="slot.role === 'tail'"
      :audio-only="slot.audioOnly"
      :random-start="slot.randomStart"
      :play-length="slot.playLength"
      :auto-download="slot.origin === 'foreground' && Boolean($attrs['auto-download'] ?? $attrs.autoDownload)"
      :managed="{ presentationId: slot.id, role: slot.role }"
      :master-volume="masterVolume"
      @managed-state="emit('report', slot.id, $event)"
      @update:master-volume="masterVolume = $event"
      @local-path-updated="emit('local-path-updated', { cardId: slot.card.id, ...$event })"
      @local-path-cleared="emit('local-path-cleared', { cardId: slot.card.id, ...$event })"
      @update:media-kind="adopt(slot) && emit('update:media-kind', $event)"
    >
      <template #error-actions><slot name="error-actions" /></template>
    </StudyMediaPlayer>
  </div>
</template>

<style scoped>
/* Both pictures share one cell so the outgoing song can stay beneath the
   incoming one. The properties are the hooks the dissolve drives; at their
   defaults the incoming picture is opaque and the outgoing one invisible. */
.mix-stack {
  --incoming-opacity: 1;
  --tail-opacity: 0;
  display: grid;
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  min-height: 0;
  min-width: 0;
}

.mix-stack :deep(.player-card) {
  grid-area: 1 / 1;
  min-width: 0;
  position: relative;
  z-index: 1;
  opacity: var(--incoming-opacity);
}

.mix-stack :deep(.player-card.ghost) {
  z-index: 0;
  opacity: var(--tail-opacity);
}
</style>
