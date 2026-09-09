import { afterEach, describe, expect, it, vi } from "vitest";
import { postGraphQL, ProviderRequestError, ProviderUnavailableError, retryAfterMs } from "./graphql.ts";

const request = () => postGraphQL("https://provider.example", "Provider", "query {}", {});
afterEach(() => vi.unstubAllGlobals());

describe("provider failure classification", () => {
  it.each([403, 429, 500, 502, 503])("classifies HTTP %s before parsing an outage's HTML body", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>unavailable</html>", { status })));
    await expect(request()).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it.each([400, 401, 422])("does not hide HTTP %s request errors as outages", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid", { status })));
    await expect(request()).rejects.toBeInstanceOf(ProviderRequestError);
  });

  it.each(["invalid JSON", "null", '{"data":null}', '{"errors":[{"message":"Internal error"}]}'])("rejects unusable responses: %s", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    await expect(request()).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("does not fall back on GraphQL validation errors, even alongside partial data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: {}, errors: [{ message: "Cannot query field foo" }] })));
    await expect(request()).rejects.toBeInstanceOf(ProviderRequestError);
  });

  it.each([new TypeError("fetch failed"), new DOMException("Timed out", "TimeoutError")])("classifies network/timeout rejection", async (error) => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(request()).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("bounds requests, including body reading, with a five-second abort signal", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: {} }));
    vi.stubGlobal("fetch", fetch);
    await request();
    expect(timeout).toHaveBeenCalledWith(5_000);
    expect(fetch.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
    timeout.mockRestore();
  });

  it("carries Retry-After only for rate limiting", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "120" } })));
    await expect(request()).rejects.toMatchObject({ retryAfterMs: 120_000 });
  });
});

describe("Retry-After", () => {
  it("accepts seconds or future HTTP dates and rejects invalid/past values", () => {
    const now = Date.parse("2026-09-09T12:00:00Z");
    expect(retryAfterMs("120", now)).toBe(120_000);
    expect(retryAfterMs("Wed, 09 Sep 2026 12:03:00 GMT", now)).toBe(180_000);
    expect(retryAfterMs("Wed, 09 Sep 2026 11:00:00 GMT", now)).toBe(0);
    expect(retryAfterMs("invalid", now)).toBe(0);
    expect(retryAfterMs(null, now)).toBe(0);
  });
});
