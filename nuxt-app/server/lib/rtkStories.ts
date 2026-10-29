import { ProviderUnavailableError } from "./graphql.ts";
import { USER_AGENT } from "../utils/mediaDownload.ts";
import { assertOnline } from "../utils/networkMode.ts";
import { MAX_KANJI_STORY_LENGTH } from "../utils/kanjiStories.ts";

const RTK_BASE = "https://hochanh.github.io/rtk";
const FETCH_TIMEOUT_MS = 10_000;

export interface TopStory {
  author: string;
  text: string;
}

export type TopStoryResult = { status: "story"; story: TopStory } | { status: "none" };

export function rtkPageUrl(char: string): string {
  return `${RTK_BASE}/${encodeURIComponent(char)}/index.html`;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function toPlainText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

// The site lists each kanji's Koohii stories by votes, so the first is the top one.
export function parseTopStory(html: string): TopStory | null {
  const section = html.split(/<h2>\s*Koohii stories:\s*<\/h2>/i)[1];
  if (!section) return null;
  const match = /<p>\s*1\)\s*\[\s*(?:<a[^>]*>([\s\S]*?)<\/a>|([^\]]*))\s*\][^:<]*:\s*([\s\S]*?)<\/p>/i.exec(section);
  if (!match) return null;
  const author = toPlainText(match[1] ?? match[2] ?? "");
  const text = toPlainText(match[3] ?? "").slice(0, MAX_KANJI_STORY_LENGTH).trim();
  if (!author || !text) return null;
  return { author, text };
}

export async function fetchTopStory(char: string): Promise<TopStoryResult> {
  assertOnline();
  let response: Response;
  try {
    response = await fetch(rtkPageUrl(char), {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new ProviderUnavailableError("The RTK story site");
  }
  if (response.status === 404) return { status: "none" };
  if (!response.ok) throw new ProviderUnavailableError("The RTK story site");
  let html: string;
  try {
    html = await response.text();
  } catch {
    throw new ProviderUnavailableError("The RTK story site");
  }
  const story = parseTopStory(html);
  return story ? { status: "story", story } : { status: "none" };
}
