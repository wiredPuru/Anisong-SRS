// Shared so the rail can hide Kanji Study the moment Settings turns the breakdown off.
export function useJapaneseBreakdownSetting() {
  const enabled = useState<boolean>("japaneseBreakdownEnabled", () => false);

  async function refresh(): Promise<void> {
    try {
      const settings = await $fetch<{ japaneseBreakdown?: boolean }>("/api/media-library");
      enabled.value = settings.japaneseBreakdown ?? false;
    } catch {
      // Keep the last known value; the rail entry is a convenience.
    }
  }

  return { enabled, refresh };
}
