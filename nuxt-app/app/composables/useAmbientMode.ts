export function useAmbientMode() {
  return useState<boolean>("ambient-mode", () => false);
}
