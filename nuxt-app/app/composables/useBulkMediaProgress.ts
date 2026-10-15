import { reactive, ref } from "vue";

export interface BulkStep {
  label: string;
  run: () => Promise<boolean>;
}

export interface BulkProgress {
  completed: number;
  total: number;
  failed: number;
  current: string | null;
}

export interface BulkSummary {
  total: number;
  failed: number;
  // Set only when stop() ended the run early; progress.completed says how far it got.
  stopped?: true;
}

// Runs a fixed, pre-counted list of steps sequentially (matching how
// add-all/download-all already run one card at a time), so "N of M" and the
// final summary always reflect the same eligible-operation count the caller
// decided up front rather than one each result group computes its own way.
export function useBulkMediaProgress() {
  const progress = reactive<BulkProgress>({ completed: 0, total: 0, failed: 0, current: null });
  const running = ref(false);
  const summary = ref<BulkSummary | null>(null);
  let stopRequested = false;

  async function runSteps(steps: BulkStep[]) {
    running.value = true;
    stopRequested = false;
    summary.value = null;
    Object.assign(progress, { completed: 0, total: steps.length, failed: 0, current: null });

    try {
      for (const step of steps) {
        if (stopRequested) break;
        progress.current = step.label;
        const ok = await step.run();
        if (!ok) progress.failed += 1;
        progress.completed += 1;
      }
    } finally {
      progress.current = null;
      summary.value = stopRequested
        ? { total: progress.total, failed: progress.failed, stopped: true }
        : { total: progress.total, failed: progress.failed };
      running.value = false;
    }
  }

  // Lets the step already in flight finish, then runs no more.
  function stop() {
    if (running.value) stopRequested = true;
  }

  function reset() {
    stopRequested = false;
    running.value = false;
    summary.value = null;
    Object.assign(progress, { completed: 0, total: 0, failed: 0, current: null });
  }

  return { progress, running, summary, runSteps, stop, reset };
}
