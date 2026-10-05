import { formatThemeSlotLabel } from "./themeSlotAnswer";

export interface SessionLogExportEntry {
  card: {
    songTitle: string;
    artistName: string;
    animeTitleEnglish: string;
    animeTitleRomaji: string;
    animeTitleNative: string;
    themeSlot: string;
  };
  result: "pass" | "fail";
}

const HEADER = ["#", "Result", "Song", "Artist", "Anime (English)", "Anime (Romaji)", "Anime (Japanese)", "Theme"];

// Quotes a field only when it has to be, and prefixes a formula trigger so a
// song titled "=1+1" opens as text in a spreadsheet instead of evaluating.
function csvField(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// Oldest first, in the order the cards were reviewed.
export function buildSessionLogCsv(entries: readonly SessionLogExportEntry[]): string {
  const rows = entries.map(({ card, result }, index) => [
    String(index + 1),
    result === "pass" ? "Pass" : "Fail",
    card.songTitle,
    card.artistName,
    card.animeTitleEnglish,
    card.animeTitleRomaji,
    card.animeTitleNative,
    formatThemeSlotLabel(card.themeSlot),
  ]);
  return [HEADER, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

export function sessionLogFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `gaq-session-log-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`;
}
