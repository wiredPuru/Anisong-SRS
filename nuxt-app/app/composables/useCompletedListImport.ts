import { computed, onScopeDispose, reactive, ref } from "vue";
import { mergeImportCandidates, type AniListResult } from "../utils/importCandidates";
import { useImportProgress } from "./useImportProgress";

type Provider = "aniList" | "mal";
interface ListSource {
  label: string;
  status: "idle" | "pending" | "done" | "error";
  results: AniListResult[];
  error: string | null;
}

export function useCompletedListImport() {
  const aniListActivity = useImportProgress();
  const malActivity = useImportProgress();
  const activities = { aniList: aniListActivity, mal: malActivity };
  const sources = reactive<Record<Provider, ListSource>>({
    aniList: { label: "AniList", status: "idle", results: [], error: null },
    mal: { label: "MyAnimeList", status: "idle", results: [], error: null },
  });
  const started = ref(false);
  let generation = 0;
  const loading = computed(() => Object.values(sources).some((source) => source.status === "pending"));
  const results = computed(() => started.value ? mergeImportCandidates([sources.aniList.results, sources.mal.results]) : null);

  async function loadSource(provider: Provider, username: string, current: number) {
    const source = sources[provider];
    const route = provider === "aniList" ? "anilist-list" : "mal-list";
    try {
      const result = await activities[provider].run<{ results: AniListResult[] }>(
        `/api/lookup/${route}?username=${encodeURIComponent(username)}`,
      );
      if (current !== generation) return;
      if (!Array.isArray(result.results)) throw new Error("Invalid list import response.");
      source.results = result.results;
      source.status = "done";
    } catch (error) {
      if (current !== generation) return;
      source.error = error instanceof Error ? error.message : "List import failed. Please try again.";
      source.status = "error";
    }
  }

  async function run(usernames: Record<Provider, string>) {
    const current = ++generation;
    started.value = true;
    for (const provider of ["aniList", "mal"] as const) {
      activities[provider].cancel();
      Object.assign(sources[provider], {
        status: usernames[provider].trim() ? "pending" : "idle", results: [], error: null,
      });
    }
    await Promise.all((["aniList", "mal"] as const).map((provider) =>
      usernames[provider].trim() ? loadSource(provider, usernames[provider].trim(), current) : Promise.resolve(),
    ));
  }

  onScopeDispose(() => { generation += 1; });
  return { sources, activities, loading, results, run };
}
