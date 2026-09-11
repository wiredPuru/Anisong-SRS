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
}

// Runs a fixed, pre-counted list of steps sequentially (matching how
// add-all/download-all already run one card at a time), so "N of M" and the
// final summary always reflect the same eligible-operation count the caller
// decided up front rather than one each result group computes its own way.
export function useBulkMediaProgress() {
  const progress = reactive<BulkProgress>({ completed: 0, total: 0, failed: 0, current: null });
  const running = ref(false);
  const summary = ref<BulkSummary | null>(null);

  async function runSteps(steps: BulkStep[]) {
    running.value = true;
    summary.value = null;
    Object.assign(progress, { completed: 0, total: steps.length, failed: 0, current: null });

    try {
      for (const step of steps) {
        progress.current = step.label;
        const ok = await step.run();
        if (!ok) progress.failed += 1;
        progress.completed += 1;
      }
    } finally {
      progress.current = null;
      summary.value = { total: progress.total, failed: progress.failed };
      running.value = false;
    }
  }

  function reset() {
    running.value = false;
    summary.value = null;
    Object.assign(progress, { completed: 0, total: 0, failed: 0, current: null });
  }

  return { progress, running, summary, runSteps, reset };
}
