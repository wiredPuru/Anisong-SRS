import { pathToFileURL } from "node:url";
import kuroshiroModule from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

const Kuroshiro = kuroshiroModule.default;
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
