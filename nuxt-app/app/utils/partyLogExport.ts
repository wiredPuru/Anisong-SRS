import type { PartyAnswer } from "../composables/usePartyDisplay";
import { formatThemeSlotLabel } from "./themeSlotAnswer";

const HEADER = ["#", "Anime", "Romaji", "Song", "Artist", "Slot"];

function cell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The played songs, in play order, as a CSV a spreadsheet opens directly. */
export function playedLogCsv(songs: { answer: PartyAnswer }[]): string {
  const rows = songs.map(({ answer }, i) => [
    String(i + 1),
    answer.animeTitleEnglish,
    answer.animeTitleRomaji,
    answer.songTitle,
    answer.artistName,
    formatThemeSlotLabel(answer.themeSlot),
  ]);
  return [HEADER, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
