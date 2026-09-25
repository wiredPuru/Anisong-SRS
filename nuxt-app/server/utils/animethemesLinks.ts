export interface AnimeThemesVideoSlugParts {
  type: string | null;
  sequence: number | null;
  groupSlug: string | null;
  entryVersion: number | null;
  videoTags: string | null;
}

// Mirrors createVideoSlug in AnimeThemes' own web app (animethemes-web,
// src/utils/createVideoSlug.ts), which names the /anime/<slug>/<videoSlug>
// page: `<OP|ED><#>[v#][-<Group>][-<Tags>]`. Built from AnimeThemes' fields,
// never from Song.themeSlot, which can come from AnisongDB's numbering.
export function animethemesVideoSlug(parts: AnimeThemesVideoSlugParts): string | null {
  const type = parts.type?.trim();
  if (!type) return null;

  let slug = type + (parts.sequence || 1);
  if (parts.entryVersion && parts.entryVersion !== 1) slug += `v${parts.entryVersion}`;
  if (parts.groupSlug) slug += `-${parts.groupSlug}`;
  if (parts.videoTags) slug += `-${parts.videoTags}`;
  return slug;
}
