import type { StudyScope } from "./cards.ts";

/** Parses GET /api/study/next's type/id query into a scope, without checking the id exists. */
export function parseStudyScope(type: unknown, idRaw: unknown): { scope: StudyScope } | { error: string } {
  if (type === "all") return { scope: { type: "all" } };

  if (type !== "artist" && type !== "anime" && type !== "created") {
    return { error: "type must be 'all', 'artist', 'anime', or 'created'" };
  }

  const id = Number(idRaw);
  if (typeof idRaw !== "string" || idRaw.trim() === "" || !Number.isFinite(id)) {
    return { error: "id is required and must be a number" };
  }

  return { scope: { type, id } };
}
