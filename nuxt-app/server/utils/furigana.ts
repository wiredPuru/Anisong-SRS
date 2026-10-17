import { pathToFileURL } from "node:url";
import kuroshiroModule from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

// The built server hands over { default }; Vitest's interop hands over the class itself.
const Kuroshiro = kuroshiroModule.default ?? (kuroshiroModule as unknown as typeof kuroshiroModule.default);
type Kuroshiro = InstanceType<typeof Kuroshiro>;

interface KuromojiToken {
  [key: string]: unknown;
}

interface KuromojiTokenizer {
  tokenize(text: string): KuromojiToken[];
}

interface KuromojiModule {
  builder(options: { dicPath: string }): {
    build(callback: (err: Error | null, tokenizer: KuromojiTokenizer) => void): void;
  };
}

// A packaged `bun build --compile` binary can't resolve kuromoji's own
// require("async")/require("doublearray") chain at runtime - Bun's compiled
// binary doesn't do real node_modules directory-walking for a module loaded
// via a genuinely dynamic import() of a path outside the bundle (confirmed
// directly: identical code works under plain `bun run`, fails only
// compiled). scripts/package.ts pre-bundles kuromoji into one
// self-contained file (its whole dependency tree flattened in) and ships it
// as a sibling asset next to the exe, like migrations/ and public/; this
// class loads that bundle instead of going through
// kuroshiro-analyzer-kuromoji's own require("kuromoji"), mirroring what
// that package's lib/index.js does internally.
class CompiledKuromojiAnalyzer {
  private analyzer: KuromojiTokenizer | null = null;

  constructor(
    private readonly bundlePath: string,
    private readonly dictPath: string,
  ) {}

  async init(): Promise<void> {
    const kuromojiModule = ((await import(pathToFileURL(this.bundlePath).toString())) as {
      default: KuromojiModule;
    }).default;
    this.analyzer = await new Promise<KuromojiTokenizer>((resolve, reject) => {
      kuromojiModule.builder({ dicPath: this.dictPath }).build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
    });
  }

  async parse(text: string): Promise<KuromojiToken[]> {
    if (!this.analyzer) throw new Error("CompiledKuromojiAnalyzer used before init().");
    if (text.trim() === "") return [];
    return this.analyzer.tokenize(text);
  }
}

function createAnalyzer(): unknown {
  const bundlePath = process.env.GAQ_SRS_KUROMOJI_BUNDLE;
  const dictPath = process.env.GAQ_SRS_KUROMOJI_DICT_DIR;
  if (bundlePath && dictPath) {
    return new CompiledKuromojiAnalyzer(bundlePath, `${dictPath}/`);
  }
  return dictPath ? new KuromojiAnalyzer({ dictPath: `${dictPath}/` }) : new KuromojiAnalyzer();
}

let instance: Kuroshiro | null = null;
let initPromise: Promise<Kuroshiro> | null = null;

function getKuroshiro(): Promise<Kuroshiro> {
  if (instance) return Promise.resolve(instance);
  if (!initPromise) {
    initPromise = (async () => {
      const kuroshiro = new Kuroshiro();
      await kuroshiro.init(createAnalyzer());
      instance = kuroshiro;
      return kuroshiro;
    })();
  }
  return initPromise;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function toFuriganaHtml(text: string): Promise<string> {
  const kuroshiro = await getKuroshiro();
  return kuroshiro.convert(escapeHtml(text), { mode: "furigana", to: "hiragana" });
}

export type KanaTarget = "hiragana" | "katakana";

export function isKanaTarget(value: unknown): value is KanaTarget {
  return value === "hiragana" || value === "katakana";
}

// Whole-title conversion, kanji included: "歌" becomes "うた" or "ウタ".
export async function toKanaText(text: string, to: KanaTarget): Promise<string> {
  const kuroshiro = await getKuroshiro();
  return shiftKana(await kuroshiro.convert(text, { mode: "normal", to }), to);
}

// Kuroshiro leaves kana of the other script untouched when a title has no kanji
// to read, so the remaining kana are shifted here. The long-vowel mark and the
// middle dot belong to both scripts and stay.
export function shiftKana(text: string, to: KanaTarget): string {
  const pattern = to === "hiragana" ? /[\u30A1-\u30F6]/g : /[\u3041-\u3096]/g;
  const offset = to === "hiragana" ? -0x60 : 0x60;
  return text.replace(pattern, (char) => String.fromCharCode(char.charCodeAt(0) + offset));
}
