import { computed, onScopeDispose, ref, watch, type WatchSource } from "vue";

export function useActivityTimer(
  request: WatchSource<unknown>,
  active: WatchSource<boolean> = () => true,
  progress: WatchSource<unknown> = () => undefined,
) {
  const elapsedSeconds = ref(0);
  const idleSeconds = ref(0);
  let startedAt = Date.now();
  let lastProgressAt = startedAt;
  let timer: ReturnType<typeof setInterval> | undefined;

  watch([request, active], ([, isActive]) => {
    if (timer !== undefined) clearInterval(timer);
    startedAt = Date.now();
    lastProgressAt = startedAt;
    elapsedSeconds.value = 0;
    idleSeconds.value = 0;
    if (!isActive) return;
    timer = setInterval(() => {
      elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      idleSeconds.value = Math.max(0, Math.floor((Date.now() - lastProgressAt) / 1000));
    }, 1000);
  }, { immediate: true });

  watch(progress, () => {
    lastProgressAt = Date.now();
    idleSeconds.value = 0;
  });

  onScopeDispose(() => clearInterval(timer));

  return {
    elapsedSeconds,
    isSlow: computed(() => idleSeconds.value >= 15),
  };
}
