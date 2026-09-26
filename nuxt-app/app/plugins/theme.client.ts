import { watchDarkScheme } from "~/utils/theme";

// The head script sets the first theme. This fills the stored preference in
// after hydration (setting it earlier would mismatch the server-rendered
// Settings picker) and keeps System in step with an OS switch made while the
// app is open.
export default defineNuxtPlugin(() => {
  const { preference } = useTheme();
  onNuxtReady(() => {
    preference.value = readStoredPreference();
  });
  watchDarkScheme(() => {
    if (preference.value === "system") applyTheme("system");
  });
});
