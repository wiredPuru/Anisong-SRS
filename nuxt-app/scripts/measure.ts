// Measures real rendered geometry in Chrome, over the DevTools protocol.
//
// This exists because layout bugs in this app are about boxes that do not fit:
// a 16:9 player running off a short window, a pane sized by its taller sibling.
// Reading the CSS cannot answer those, and Playwright is deliberately not a
// dependency here (see Browser Verification in coding-standards.md). Chrome
// plus a WebSocket is enough, and both are already on hand.
//
// The --css flag is what makes a finding defensible: inject the reverted
// declarations, measure, drop them, measure again, and the before/after numbers
// come from one browser in one run rather than two remembered screenshots.
//
// Usage:
//   bun run measure /study --size 1920x700 --select .player-frame
//   bun run measure /study --size 1400x640 --key e --shot immersive.png
//   bun run measure /cards --click-text "This game" --select ".inspector .player-frame"
//   bun run measure /study --css ".app-content{height:auto;min-height:100vh}"

import { existsSync, readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";

const DEFAULT_BASE = "http://localhost:3000";
const DEBUG_PORT = 9222;
const DEFAULT_SIZE = "1440x900";
const DEFAULT_WAIT_MS = 4000;

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

interface Size {
  width: number;
  height: number;
}

interface Options {
  target: string;
  base: string;
  sizes: Size[];
  selectors: string[];
  css: string | null;
  clickSelector: string | null;
  clickText: string | null;
  key: string | null;
  waitFor: string | null;
  waitMs: number;
  shot: string | null;
  json: boolean;
}

interface Box {
  selector: string;
  width: number;
  height: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
  ratio: number;
  scrollHeight: number;
  clientHeight: number;
  scrollsInternally: boolean;
  insideViewport: boolean;
}

interface PageMeasurement {
  path: string;
  viewport: Size;
  pageScrolls: boolean;
  documentHeight: number;
  boxes: (Box | null)[];
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    target: "",
    base: process.env.MEASURE_BASE ?? DEFAULT_BASE,
    sizes: [],
    selectors: [],
    css: null,
    clickSelector: null,
    clickText: null,
    key: null,
    waitFor: null,
    waitMs: DEFAULT_WAIT_MS,
    shot: null,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    const next = (): string => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      i += 1;
      return value;
    };
    if (arg === "--size") opts.sizes.push(parseSize(next()));
    else if (arg === "--select") opts.selectors.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
    else if (arg === "--css") opts.css = next();
    else if (arg === "--css-file") opts.css = readTextFile(next());
    else if (arg === "--click") opts.clickSelector = next();
    else if (arg === "--click-text") opts.clickText = next();
    else if (arg === "--key") opts.key = next();
    else if (arg === "--wait-for") opts.waitFor = next();
    else if (arg === "--wait") opts.waitMs = Number(next());
    else if (arg === "--shot") opts.shot = next();
    else if (arg === "--base") opts.base = next();
    else if (arg === "--json") opts.json = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown flag ${arg}`);
    else if (!opts.target) opts.target = arg;
    else throw new Error(`Unexpected argument ${arg}`);
  }
  if (!opts.target) throw new Error("Give a path or URL, for example /study");
  if (opts.sizes.length === 0) opts.sizes.push(parseSize(DEFAULT_SIZE));
  return opts;
}

function parseSize(value: string): Size {
  const match = /^(\d+)x(\d+)$/.exec(value.trim());
  if (!match) throw new Error(`Bad --size ${value}, expected WxH such as 1920x700`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function readTextFile(path: string): string {
  if (!existsSync(path)) throw new Error(`No such file: ${path}`);
  return readFileSync(path, "utf8");
}

function findChrome(): string {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) {
    if (!existsSync(fromEnv)) throw new Error(`CHROME_PATH points at a missing file: ${fromEnv}`);
    return fromEnv;
  }
  const found = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No Chrome found. Set CHROME_PATH to the binary.");
  return found;
}

async function debuggerReady(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`, {
      signal: AbortSignal.timeout(700),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Reuses a browser already listening on the debug port so repeated runs do not
// pile up windows, and only owns (and later kills) one it started itself.
async function startChrome(): Promise<ChildProcess | null> {
  if (await debuggerReady()) return null;
  const child = spawn(findChrome(), [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${process.env.TMPDIR ?? "/tmp"}/gaq-srs-measure-profile`,
    "--no-first-run",
    "--mute-audio",
  ], { stdio: "ignore", detached: false });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await debuggerReady()) return child;
    await Bun.sleep(250);
  }
  child.kill();
  throw new Error(`Chrome did not open a debugger on port ${DEBUG_PORT}`);
}

interface CdpMessage {
  id?: number;
  result?: { result?: { value?: unknown }; data?: string; exceptionDetails?: unknown };
}

class CdpTab {
  private nextId = 1;
  private readonly pending = new Map<number, (msg: CdpMessage) => void>();

  private constructor(private readonly ws: WebSocket, private readonly tabId: string) {}

  static async open(): Promise<CdpTab> {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: "PUT" });
    const tab = (await res.json()) as { id: string; webSocketDebuggerUrl: string };
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    const instance = new CdpTab(ws, tab.id);
    ws.addEventListener("message", (event) => instance.receive(String(event.data)));
    await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
    await instance.send("Page.enable");
    await instance.send("Runtime.enable");
    return instance;
  }

  private receive(raw: string): void {
    const msg = JSON.parse(raw) as CdpMessage;
    if (msg.id === undefined) return;
    this.pending.get(msg.id)?.(msg);
    this.pending.delete(msg.id);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<CdpMessage> {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const msg = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (msg.result?.exceptionDetails) {
      throw new Error(`Page threw: ${JSON.stringify(msg.result.exceptionDetails).slice(0, 400)}`);
    }
    return msg.result?.result?.value as T;
  }

  async screenshot(path: string): Promise<void> {
    const msg = await this.send("Page.captureScreenshot", { format: "png" });
    await Bun.write(path, Buffer.from(String(msg.result?.data ?? ""), "base64"));
  }

  async close(): Promise<void> {
    this.ws.close();
    await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${this.tabId}`).catch(() => undefined);
  }
}

const MEASURE_FN = `(selectors) => {
  const doc = document.documentElement;
  const box = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const round = (n) => Math.round(n * 10) / 10;
    return {
      selector,
      width: round(r.width), height: round(r.height),
      top: round(r.top), left: round(r.left),
      bottom: round(r.bottom), right: round(r.right),
      ratio: r.height === 0 ? 0 : round(r.width / r.height * 100) / 100,
      scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      scrollsInternally: el.scrollHeight > el.clientHeight + 1,
      insideViewport: r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5
        && r.left >= -0.5 && r.right <= window.innerWidth + 0.5,
    };
  };
  return {
    path: location.pathname + location.search,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    pageScrolls: doc.scrollHeight > doc.clientHeight + 1,
    documentHeight: doc.scrollHeight,
    boxes: selectors.map(box),
  };
}`;

async function measureOnce(opts: Options, size: Size, url: string): Promise<PageMeasurement> {
  const tab = await CdpTab.open();
  try {
    await tab.send("Emulation.setDeviceMetricsOverride", {
      width: size.width,
      height: size.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await tab.send("Page.navigate", { url });
    await settle(tab, opts);
    if (opts.css) await injectCss(tab, opts.css);
    if (opts.clickSelector || opts.clickText) await click(tab, opts);
    if (opts.key) await pressKey(tab, opts.key);
    if (opts.clickSelector || opts.clickText || opts.key) await Bun.sleep(1500);
    const result = await tab.evaluate<PageMeasurement>(
      `(${MEASURE_FN})(${JSON.stringify(opts.selectors)})`,
    );
    if (opts.shot) await tab.screenshot(shotPath(opts, size));
    return result;
  } finally {
    await tab.close();
  }
}

// Nuxt hydrates and then fetches, so a load event alone is too early. --wait-for
// is the honest signal when there is one; otherwise fall back to a fixed wait.
async function settle(tab: CdpTab, opts: Options): Promise<void> {
  if (!opts.waitFor) {
    await Bun.sleep(opts.waitMs);
    return;
  }
  const deadline = Date.now() + opts.waitMs + 10_000;
  while (Date.now() < deadline) {
    const found = await tab.evaluate<boolean>(`!!document.querySelector(${JSON.stringify(opts.waitFor)})`);
    if (found) {
      await Bun.sleep(800);
      return;
    }
    await Bun.sleep(250);
  }
  throw new Error(`--wait-for ${opts.waitFor} never appeared`);
}

async function injectCss(tab: CdpTab, css: string): Promise<void> {
  await tab.evaluate(`(() => {
    const el = document.createElement("style");
    el.dataset.measureOverride = "1";
    el.textContent = ${JSON.stringify(css)};
    document.head.appendChild(el);
  })()`);
  await Bun.sleep(600);
}

async function click(tab: CdpTab, opts: Options): Promise<void> {
  const expression = opts.clickSelector
    ? `(() => {
        const el = document.querySelector(${JSON.stringify(opts.clickSelector)});
        if (!el) return "no match";
        el.click();
        return "clicked";
      })()`
    : `(() => {
        const needle = ${JSON.stringify(opts.clickText ?? "")}.toLowerCase();
        const el = [...document.querySelectorAll("button, a, li, [role=button]")]
          .find((node) => (node.textContent || "").toLowerCase().includes(needle));
        if (!el) return "no match";
        el.click();
        return "clicked";
      })()`;
  const outcome = await tab.evaluate<string>(expression);
  if (outcome === "no match") throw new Error(`Nothing to click for ${opts.clickSelector ?? opts.clickText}`);
}

async function pressKey(tab: CdpTab, key: string): Promise<void> {
  const code = `Key${key.toUpperCase()}`;
  const vk = key.toUpperCase().charCodeAt(0);
  const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  await tab.send("Input.dispatchKeyEvent", { ...base, type: "keyDown", text: key });
  await tab.send("Input.dispatchKeyEvent", { ...base, type: "keyUp" });
}

function shotPath(opts: Options, size: Size): string {
  const shot = opts.shot as string;
  if (opts.sizes.length === 1) return shot;
  const suffix = `-${size.width}x${size.height}`;
  const dot = shot.lastIndexOf(".");
  return dot === -1 ? shot + suffix : shot.slice(0, dot) + suffix + shot.slice(dot);
}

function report(measurements: PageMeasurement[]): void {
  for (const m of measurements) {
    const size = `${m.viewport.width}x${m.viewport.height}`;
    console.log(`\n${m.path}  @ ${size}   page scrolls: ${m.pageScrolls}  (document ${m.documentHeight}px)`);
    if (m.boxes.length === 0) continue;
    console.log("  selector                        box            ratio  inside vp  scrolls");
    for (const box of m.boxes) {
      if (!box) {
        console.log("  (selector not found)");
        continue;
      }
      const dims = `${box.width}x${box.height}`;
      console.log(
        `  ${box.selector.padEnd(30).slice(0, 30)}  ${dims.padEnd(14)} ${String(box.ratio).padEnd(6)} ` +
        `${String(box.insideViewport).padEnd(10)} ${box.scrollsInternally}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const url = opts.target.startsWith("http") ? opts.target : opts.base + opts.target;
  const owned = await startChrome();
  try {
    const measurements: PageMeasurement[] = [];
    for (const size of opts.sizes) {
      measurements.push(await measureOnce(opts, size, url));
    }
    if (opts.json) console.log(JSON.stringify(measurements, null, 2));
    else report(measurements);
  } finally {
    owned?.kill();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
