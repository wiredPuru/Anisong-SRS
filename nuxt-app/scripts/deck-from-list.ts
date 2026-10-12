// Builds a manual deck from a list of songs, through the running app's own routes,
// so Clip source, Include insert songs and the duplicate-card check all apply.
//
// Usage (with the app running):
//   bun run deck-from-list scripts/deck-lists/6jpcBv8ADb8.json
//   bun run deck-from-list <list.json> --dry-run   # report matches, add nothing
//   bun run deck-from-list <list.json> --base http://localhost:3000
//
// Each entry is tried with the song search first, then by importing the anime
// found on AniList and picking the theme from its list. Anything still unmatched
// is printed and left out rather than guessed.

import { readFileSync } from "node:fs";
import { type Candidate, type ListEntry, parseDeckList, pickBest } from "./deckFromList.ts";

interface SongResult extends Candidate {
  resultKey: string;
  animeTitleRomaji: string;
  clipBlocked?: boolean;
  [key: string]: unknown;
}

interface ImportedTheme {
  songId: number;
  themeSlot: string;
  songTitle: string;
  artistName: string;
  videoUrl: string | null;
  audioUrl: string | null;
  clipBlocked: boolean;
  noAnimethemesMatch: boolean;
}

interface Picked {
  songId: number | null;
  describe: string;
  add: () => Promise<number | null>;
}

const args = process.argv.slice(2);
const listPath = args.find((arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--base");
const dryRun = args.includes("--dry-run");
const baseIndex = args.indexOf("--base");
const base = (baseIndex >= 0 ? args[baseIndex + 1] : undefined) ?? "http://localhost:3000";

if (!listPath) {
  console.error("Usage: bun run deck-from-list <list.json> [--dry-run] [--base http://localhost:3000]");
  process.exit(1);
}

async function api<T>(path: string, init?: { method: string; body: unknown }): Promise<T> {
  const response = await fetch(`${base}${path}`, init
    ? { method: init.method, headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) }
    : undefined);
  if (!response.ok) {
    let message = `${response.status}`;
    try {
      const body = await response.json() as { statusMessage?: string; message?: string };
      message = body.statusMessage ?? body.message ?? message;
    } catch {}
    throw new Error(`${path}: ${message}`);
  }
  return response.json() as Promise<T>;
}

async function cardForSong(songId: number, videoUrl: string | null, audioUrl: string | null): Promise<number | null> {
  const existing = await api<{ cards: { id: number }[] }>(`/api/cards/by-songs?songIds=${songId}`);
  if (existing.cards[0]) return existing.cards[0].id;
  if (!videoUrl && !audioUrl) return null;
  const created = await api<{ card: { id: number } }>("/api/cards", {
    method: "POST",
    body: { songId, animethemesVideoUrl: videoUrl ?? undefined, animethemesAudioUrl: audioUrl ?? undefined },
  });
  return created.card.id;
}

function label(song: Candidate): string {
  return `${song.animeTitle} ${song.themeSlot} - ${song.songTitle} (${song.artistName})`;
}

async function bySongSearch(entry: ListEntry): Promise<Picked | null> {
  for (const query of entry.songs) {
    const { results } = await api<{ results: SongResult[] }>(`/api/lookup/song-search?q=${encodeURIComponent(query)}`);
    const candidates = results
      .filter((result) => !result.clipBlocked)
      .map((result) => ({ ...result, animeTitle: result.animeTitleRomaji }));
    const best = pickBest(entry, candidates);
    if (!best) continue;
    return {
      songId: null,
      describe: label(best),
      add: async () => {
        const { animeTitle: _animeTitle, ...body } = best;
        const imported = await api<{ songId: number; videoUrl: string | null; audioUrl: string | null; noAnimethemesMatch: boolean }>(
          "/api/lookup/song-import", { method: "POST", body },
        );
        if (imported.noAnimethemesMatch) throw new Error("blocked by the AnimeThemes-only setting");
        return cardForSong(imported.songId, imported.videoUrl, imported.audioUrl);
      },
    };
  }
  return null;
}

async function byAnimeImport(entry: ListEntry): Promise<Picked | null> {
  if (!entry.animeSearch) return null;
  const { results } = await api<{ results: { aniListId: number }[] }>(`/api/lookup/anilist-search?q=${encodeURIComponent(entry.animeSearch)}`);
  for (const anime of results.slice(0, 3)) {
    const imported = await api<{ anime: { titleRomaji: string }; themes: ImportedTheme[] }>(
      "/api/lookup/import", { method: "POST", body: { aniListId: anime.aniListId } },
    );
    const candidates = imported.themes
      .filter((theme) => !theme.clipBlocked && !theme.noAnimethemesMatch)
      .map((theme) => ({ ...theme, animeTitle: imported.anime.titleRomaji }));
    const best = pickBest(entry, candidates, true);
    if (!best) continue;
    return {
      songId: best.songId,
      describe: label(best),
      add: () => cardForSong(best.songId, best.videoUrl, best.audioUrl),
    };
  }
  return null;
}

async function findDeckId(name: string): Promise<number> {
  try {
    const created = await api<{ deck: { id: number } }>("/api/decks", { method: "POST", body: { name } });
    return created.deck.id;
  } catch (error) {
    if (!String(error).includes("already exists")) throw error;
    const { decks } = await api<{ decks: { id: number; name: string }[] }>(`/api/decks?type=created&q=${encodeURIComponent(name)}`);
    const match = decks.find((deck) => deck.name === name);
    if (!match) throw error;
    return match.id;
  }
}

async function main() {
  const list = parseDeckList(JSON.parse(readFileSync(listPath!, "utf8")));
  console.log(`${dryRun ? "Dry run: " : ""}deck "${list.deck}", ${list.entries.length} songs, via ${base}\n`);

  const cardIds: number[] = [];
  const missed: string[] = [];

  for (const [index, entry] of list.entries.entries()) {
    const prefix = `${String(index + 1).padStart(2)}. ${entry.label}`;
    try {
      const picked = (await bySongSearch(entry)) ?? (await byAnimeImport(entry));
      if (!picked) {
        missed.push(entry.label + (entry.note ? ` (${entry.note})` : ""));
        console.log(`${prefix}\n    not found`);
        continue;
      }
      if (dryRun) {
        console.log(`${prefix}\n    -> ${picked.describe}`);
        continue;
      }
      const cardId = await picked.add();
      if (cardId === null) {
        missed.push(`${entry.label} (no playable clip)`);
        console.log(`${prefix}\n    -> ${picked.describe}, but it has no playable clip`);
        continue;
      }
      cardIds.push(cardId);
      console.log(`${prefix}\n    -> ${picked.describe}`);
    } catch (error) {
      missed.push(`${entry.label} (${error instanceof Error ? error.message : String(error)})`);
      console.log(`${prefix}\n    failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!dryRun && cardIds.length > 0) {
    const deckId = await findDeckId(list.deck);
    const unique = [...new Set(cardIds)];
    await api("/api/decks/cards", { method: "POST", body: { deckId, cardIds: unique } });
    console.log(`\nAdded ${unique.length} cards to "${list.deck}".`);
  } else if (!dryRun) {
    console.log("\nNothing matched, so no deck was created.");
  }

  if (missed.length > 0) {
    console.log(`\nNot added (${missed.length}):`);
    for (const line of missed) console.log(`  - ${line}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error(`Is the app running at ${base}? Start it with \`bun run dev\` or the packaged app first.`);
  process.exit(1);
});
