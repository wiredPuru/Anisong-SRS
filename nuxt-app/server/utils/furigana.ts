import kuroshiroModule from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

const Kuroshiro = kuroshiroModule.default;
type Kuroshiro = InstanceType<typeof Kuroshiro>;

let instance: Kuroshiro | null = null;
let initPromise: Promise<Kuroshiro> | null = null;

function getKuroshiro(): Promise<Kuroshiro> {
  if (instance) return Promise.resolve(instance);
  if (!initPromise) {
    initPromise = (async () => {
      const kuroshiro = new Kuroshiro();
      await kuroshiro.init(new KuromojiAnalyzer());
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
