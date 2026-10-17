import type { CardWithDetails } from "~/composables/useStudySession";
import type { ClipSource } from "~/utils/clipSource";
import { backgroundClips, nextClipIndex } from "~/utils/kanjiStudy";

const MAX_BACKGROUND_CLIPS = 60;

interface QueueReply {
  cards: CardWithDetails[];
}

// Random library clips played one after another. Loading is best effort: with
// no playable clip the page simply has no player.
export function useBackgroundClips(clipSource: ComputedRef<ClipSource>) {
  const clips = ref<CardWithDetails[]>([]);
  const index = ref(0);
  // Bumped on every clip shown so the player gets a fresh mount, even for a wrap onto the same card.
  const presentationKey = ref(0);
  const current = computed<CardWithDetails | null>(() => clips.value[index.value] ?? null);

  async function load() {
    try {
      const reply = await $fetch<QueueReply>("/api/listen/queue", {
        method: "POST",
        body: { scope: { type: "all" }, shuffle: true },
      });
      clips.value = backgroundClips(reply.cards, clipSource.value, MAX_BACKGROUND_CLIPS);
      index.value = 0;
      presentationKey.value += 1;
    } catch {
      clips.value = [];
    }
  }

  function next() {
    if (clips.value.length === 0) return;
    index.value = nextClipIndex(index.value, clips.value.length);
    presentationKey.value += 1;
  }

  return { current, presentationKey, load, next };
}
