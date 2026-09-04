// The repo name deliberately differs from the local directory name (GAQ_SRS);
// never derive it from the folder.
export const GITHUB_REPO = "wiredPuru/Anisong-SRS";

// GitHub rejects API requests that send no User-Agent. Same trap that already
// cost this project two fixes: animethemes.moe (feature 3) and the packaged
// Windows AniList 403 (feature 48).
const USER_AGENT = "GAQ-SRS/1.0 (personal AMQ study app)";
const REQUEST_TIMEOUT_MS = 5000;

// A packaged app is launched fresh per session, so a long success TTL means
// roughly one call per launch, far inside GitHub's 60/hour unauthenticated
// limit. Failures are re-tried sooner, but not on every page load.
const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 10 * 60 * 1000;

export interface UpdateStatus {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  checkFailed: boolean;
  checkedAt: string;
}

// Only the remote lookup is cached. `updateAvailable` is recomputed per call
// against the running version, so a cached result can never outlive the
// version it was compared against.
interface ReleaseLookup {
  latest: string | null;
  releaseUrl: string | null;
  checkFailed: boolean;
  checkedAt: string;
}

let cached: { lookup: ReleaseLookup; expiresAt: number } | null = null;

function parseVersion(raw: string): number[] | null {
  const trimmed = raw.trim().replace(/^v/i, "");
  if (!trimmed) return null;

  const parts = trimmed.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0)) return null;

  return parts;
}

// Compared part by part as numbers, never as strings: "1.10.0" < "1.9.0"
// lexically, which would hide every release past x.9.
export function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);
  if (!latestParts || !currentParts) return false;

  const length = Math.max(latestParts.length, currentParts.length);
  for (let index = 0; index < length; index++) {
    const a = latestParts[index] ?? 0;
    const b = currentParts[index] ?? 0;
    if (a !== b) return a > b;
  }

  return false;
}

// Never throws and never surfaces an error state: an offline machine, a rate
// limit, a repo with no releases yet, or malformed JSON all degrade to "no
// update notice", which is the same thing the user saw before this feature.
export async function getUpdateStatus(current: string): Promise<UpdateStatus> {
  const lookup = await getReleaseLookup();

  return {
    current,
    latest: lookup.latest,
    updateAvailable: lookup.latest ? isNewerVersion(lookup.latest, current) : false,
    releaseUrl: lookup.releaseUrl,
    checkFailed: lookup.checkFailed,
    checkedAt: lookup.checkedAt,
  };
}

async function getReleaseLookup(): Promise<ReleaseLookup> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.lookup;

  const checkedAt = new Date().toISOString();
  let lookup: ReleaseLookup;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) throw new Error(`GitHub responded ${response.status}`);

    const release = (await response.json()) as { tag_name?: unknown; html_url?: unknown };

    lookup = {
      latest: typeof release.tag_name === "string" ? release.tag_name : null,
      releaseUrl: typeof release.html_url === "string" ? release.html_url : null,
      checkFailed: false,
      checkedAt,
    };
  } catch {
    lookup = { latest: null, releaseUrl: null, checkFailed: true, checkedAt };
  }

  cached = {
    lookup,
    expiresAt: now + (lookup.checkFailed ? FAILURE_TTL_MS : SUCCESS_TTL_MS),
  };

  return lookup;
}
