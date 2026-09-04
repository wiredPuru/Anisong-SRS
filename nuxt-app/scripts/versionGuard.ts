export interface VersionGuardInput {
  packageVersion: string;
  // null when the baked value could not be found in .output, which is not
  // treated as a failure: a future Nitro layout change should not block a
  // release, only lose this one check.
  bakedVersion: string | null;
  // null when HEAD carries no tag, the normal case since tagging usually
  // follows packaging.
  headTag: string | null;
}

export interface VersionGuardResult {
  ok: boolean;
  message: string;
}

export function checkPackagedVersion({
  packageVersion,
  bakedVersion,
  headTag,
}: VersionGuardInput): VersionGuardResult {
  if (bakedVersion !== null && bakedVersion !== packageVersion) {
    return {
      ok: false,
      message:
        `Stale build: .output carries ${bakedVersion} but package.json says ${packageVersion}. ` +
        `Run "bun run build" before packaging.`,
    };
  }

  if (headTag !== null && headTag.replace(/^v/i, "") !== packageVersion) {
    return {
      ok: false,
      message:
        `Tag mismatch: HEAD is tagged ${headTag} but package.json says ${packageVersion}. ` +
        `Bump one to match the other before packaging.`,
    };
  }

  if (bakedVersion === null) {
    return {
      ok: true,
      message:
        `Packaging ${packageVersion} (could not read the baked version from .output to confirm it).`,
    };
  }

  return { ok: true, message: `Packaging ${packageVersion}.` };
}
