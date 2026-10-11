export interface SongLogEntry {
  number: number;
  anime: string;
  song: string;
  artist: string;
  scored: boolean;
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The played songs as CSV, oldest first (the log itself is newest first). */
export function songLogToCsv(log: readonly SongLogEntry[]): string {
  const rows = [...log]
    .sort((a, b) => a.number - b.number)
    .map((entry) => [String(entry.number), entry.anime, entry.song, entry.artist, entry.scored ? "yes" : "no"].map(csvCell).join(","));
  return ["#,Anime,Song,Artist,I scored", ...rows].join("\r\n");
}

export function songLogFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `party-songs-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}
