export function createLatestRequest() {
  let generation = 0;
  return {
    start() {
      const current = ++generation;
      return () => current === generation;
    },
    invalidate() {
      generation += 1;
    },
  };
}
