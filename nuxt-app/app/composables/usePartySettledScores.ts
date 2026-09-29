import type { PartyDisplayState, PartyRoundPoint } from "~/composables/usePartyDisplay";
import { needsSettle, type PartyScoreView, SCORE_SETTLE_MS, scorePops } from "~/utils/partyScoreSettle";

export const SCORE_POP_MS = 2600;

export interface PartyScorePop extends PartyRoundPoint {
  key: number;
}

/**
 * The scoreboard and round points as the display shows them: a burst of
 * score changes lands once, SCORE_SETTLE_MS after the last one, as a single
 * "+N" pop per player (feature 91a). The host panel is not delayed.
 */
export function usePartySettledScores(state: Ref<PartyDisplayState | null>) {
  const shown = ref<PartyScoreView | null>(null);
  const pops = ref<PartyScorePop[]>([]);
  let pending: PartyScoreView | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  const popTimers = new Set<ReturnType<typeof setTimeout>>();
  let nextKey = 0;

  function apply(next: PartyScoreView) {
    const risen = shown.value ? scorePops(shown.value, next) : [];
    shown.value = next;
    for (const pop of risen) {
      const key = nextKey++;
      pops.value = [...pops.value, { ...pop, key }];
      const timer = setTimeout(() => {
        popTimers.delete(timer);
        pops.value = pops.value.filter((p) => p.key !== key);
      }, SCORE_POP_MS);
      popTimers.add(timer);
    }
  }

  function flush() {
    clearTimeout(settleTimer);
    if (pending) apply(pending);
    pending = null;
  }

  function receive(next: PartyScoreView) {
    if (!shown.value) {
      shown.value = next;
      return;
    }
    // A song change first lands whatever the last one was still settling.
    if (pending && pending.token !== next.token) flush();
    if (!needsSettle(shown.value, next)) {
      clearTimeout(settleTimer);
      pending = null;
      apply(next);
      return;
    }
    // Other updates (play, pause, a reveal) must not push the settle back.
    const changed = !pending || needsSettle(pending, next);
    pending = next;
    if (changed) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(flush, SCORE_SETTLE_MS);
    }
  }

  watch(
    state,
    (value) => {
      if (value) receive({ token: value.item?.token ?? null, roundPoints: value.roundPoints, scoreboard: value.scoreboard });
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    clearTimeout(settleTimer);
    for (const timer of popTimers) clearTimeout(timer);
  });

  return { scores: shown, pops };
}
