declare module "kuroshiro" {
  interface KuroshiroConvertOptions {
    to?: "hiragana" | "katakana" | "romaji";
    mode?: "normal" | "spaced" | "okurigana" | "furigana";
  }

  class Kuroshiro {
    init(analyzer: unknown): Promise<void>;
    convert(text: string, options?: KuroshiroConvertOptions): Promise<string>;
  }

  // kuroshiro's CJS build only sets `exports.default`, never reassigns
  // `module.exports` - so the default ESM import lands on the whole CJS
  // exports object, not the class itself. Confirmed at runtime (see
  // furigana.ts). This shape reflects that, instead of the class directly.
  interface KuroshiroModule {
    default: typeof Kuroshiro;
  }

  const kuroshiroModule: KuroshiroModule;
  export default kuroshiroModule;
}

declare module "kuroshiro-analyzer-kuromoji" {
  interface KuromojiAnalyzerOptions {
    dictPath?: string;
  }

  export default class KuromojiAnalyzer {
    constructor(options?: KuromojiAnalyzerOptions);
  }
}
