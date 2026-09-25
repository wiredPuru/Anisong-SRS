export interface SourceLink {
  site: "anilist" | "animethemes";
  label: string;
  href: string;
  title: string;
}

export function buildSourceLinks(card: {
  animeAniListId: number;
  animeAnimethemesSlug: string | null;
  animethemesVideoSlug: string | null;
}): SourceLink[] {
  const links: SourceLink[] = [
    {
      site: "anilist",
      label: "AniList",
      href: `https://anilist.co/anime/${encodeURIComponent(card.animeAniListId)}`,
      title: "Open on AniList",
    },
  ];

  // A video slug alone is not a path: the theme page lives under the anime's.
  if (card.animeAnimethemesSlug) {
    const showPath = `https://animethemes.moe/anime/${encodeURIComponent(card.animeAnimethemesSlug)}`;
    links.push(
      card.animethemesVideoSlug
        ? {
            site: "animethemes",
            label: "AnimeThemes",
            href: `${showPath}/${encodeURIComponent(card.animethemesVideoSlug)}`,
            title: "Open this theme on AnimeThemes",
          }
        : { site: "animethemes", label: "AnimeThemes", href: showPath, title: "Open the show on AnimeThemes" },
    );
  }
  return links;
}
