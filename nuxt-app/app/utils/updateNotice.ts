export interface NoteSpan {
  text: string;
  bold?: boolean;
  code?: boolean;
}

export type NoteBlock =
  | { type: "heading"; text: string }
  | { type: "list"; items: NoteSpan[][] }
  | { type: "paragraph"; spans: NoteSpan[] };

const INLINE_TOKEN = /(\*\*[^*]+\*\*|`[^`]+`)/;

function parseInline(line: string): NoteSpan[] {
  return line
    .split(INLINE_TOKEN)
    .filter((part) => part !== "")
    .map((part) => {
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        return { text: part.slice(2, -2), bold: true };
      }
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
        return { text: part.slice(1, -1), code: true };
      }
      return { text: part };
    });
}

function headingText(line: string): string | null {
  const hashed = /^#{1,6}\s+(.+)$/.exec(line);
  if (hashed) return hashed[1]!.trim();
  const bolded = /^\*\*([^*]+)\*\*$/.exec(line);
  return bolded ? bolded[1]!.trim() : null;
}

// Covers only the Markdown subset the release notes use. The notes arrive from
// the network, so they become plain data the template renders, never HTML.
export function parseReleaseNotes(markdown: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let list: NoteSpan[][] | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", spans: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", items: list });
    list = null;
  };

  for (const rawLine of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    const bullet = /^[-*]\s+(.+)$/.exec(line);

    if (!line) {
      flushParagraph();
      flushList();
    } else if (bullet) {
      flushParagraph();
      (list ??= []).push(parseInline(bullet[1]!));
    } else if (headingText(line) !== null) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: headingText(line)! });
    } else {
      flushList();
      paragraph.push(line);
    }
  }

  flushParagraph();
  flushList();
  return blocks;
}

const PLATFORM_LABELS: Record<string, string> = {
  "gaq-srs-windows-x64.zip": "Windows",
  "gaq-srs-macos-x64.zip": "macOS (Intel)",
  "gaq-srs-macos-arm64.zip": "macOS (Apple Silicon)",
  "gaq-srs-linux-x64.zip": "Linux",
};

export function downloadPlatformLabel(downloadUrl: string): string | null {
  const fileName = downloadUrl.split("/").pop() ?? "";
  return PLATFORM_LABELS[fileName] ?? null;
}
