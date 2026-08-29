export function useAmbientGlass() {
  const active = useState<boolean>("ambientGlassActive", () => false);

  function setAmbientGlass(value: boolean) {
    active.value = value;
    if (!import.meta.client) return;
    if (value) {
      document.documentElement.setAttribute("data-ambient-glass", "true");
    } else {
      document.documentElement.removeAttribute("data-ambient-glass");
    }
  }

  return { active, setAmbientGlass };
}
