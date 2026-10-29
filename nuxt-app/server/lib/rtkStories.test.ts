import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTopStory, parseTopStory, rtkPageUrl } from "./rtkStories.ts";

const mocks = vi.hoisted(() => ({ offline: false }));

vi.mock("../utils/networkMode.ts", () => ({
  assertOnline: () => {
    if (mocks.offline) throw Object.assign(new Error("offline"), { statusCode: 409 });
  },
}));

function page(stories: string): string {
  return `<h2><code>flower</code></h2><h3>On-Yomi: <a>カ</a></h3><h2>Koohii stories:</h2>\n${stories}\n<hr>`;
}

const FLOWER = page(
  `<p>1) [<a href="http://kanji.koohii.com/profile/Copycatken">Copycatken</a>] 24-6-2006(210): The<strong> flower</strong>s <em>change</em> with the seasons.</p>
<p>2) [<a href="http://kanji.koohii.com/profile/Other">Other</a>] 15-6-2006(61): Second story.</p>`,
);

afterEach(() => {
  mocks.offline = false;
  vi.unstubAllGlobals();
});

describe("parseTopStory", () => {
  it("takes the first story, its author, and strips the markup", () => {
    expect(parseTopStory(FLOWER)).toEqual({ author: "Copycatken", text: "The flowers change with the seasons." });
  });

  it("decodes entities and keeps inner text of nested tags", () => {
    const html = page(
      `<p>1) [<a href="x">a&amp;b</a>] 1-1-2010(5): Tom &amp; Jerry say &quot;hi&quot; &#39;now&#39;<br>and <strong><em>go</em></strong>.</p>`,
    );
    expect(parseTopStory(html)).toEqual({ author: "a&b", text: `Tom & Jerry say "hi" 'now' and go.` });
  });

  it("is null when the page has no stories", () => {
    expect(parseTopStory(page(""))).toBeNull();
    expect(parseTopStory("<h1>nothing here</h1>")).toBeNull();
  });

  it("is null when the first entry is malformed", () => {
    expect(parseTopStory(page("<p>1) no author or colon</p>"))).toBeNull();
  });

  it("truncates a story longer than the editor limit", () => {
    const long = "x".repeat(3000);
    const result = parseTopStory(page(`<p>1) [<a href="x">a</a>] 1-1-2010(5): ${long}</p>`));
    expect(result?.text).toHaveLength(2000);
  });
});

describe("fetchTopStory", () => {
  function stubFetch(response: Response | Error) {
    const fetchMock = vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("requests the kanji's page and returns the top story", async () => {
    const fetchMock = stubFetch(new Response(FLOWER, { status: 200 }));
    await expect(fetchTopStory("花")).resolves.toEqual({
      status: "story",
      story: { author: "Copycatken", text: "The flowers change with the seasons." },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(rtkPageUrl("花"));
    expect(rtkPageUrl("花")).toBe("https://hochanh.github.io/rtk/%E8%8A%B1/index.html");
  });

  it("reports a missing page, or a page with no story, as none", async () => {
    stubFetch(new Response("", { status: 404 }));
    await expect(fetchTopStory("𠀀")).resolves.toEqual({ status: "none" });
    stubFetch(new Response(page(""), { status: 200 }));
    await expect(fetchTopStory("花")).resolves.toEqual({ status: "none" });
  });

  it("treats a server error or a network failure as unavailable", async () => {
    stubFetch(new Response("", { status: 500 }));
    await expect(fetchTopStory("花")).rejects.toMatchObject({ statusCode: 503 });
    stubFetch(new Error("offline"));
    await expect(fetchTopStory("花")).rejects.toMatchObject({ statusCode: 503 });
  });

  it("makes no request while Offline mode is on", async () => {
    mocks.offline = true;
    const fetchMock = stubFetch(new Response(FLOWER, { status: 200 }));
    await expect(fetchTopStory("花")).rejects.toMatchObject({ statusCode: 409 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
