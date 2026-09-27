import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLoginLimiter,
  createSessionStore,
  hashPassword,
  isLoopbackAddress,
  verifyPassword,
} from "./partyAuth.ts";

describe("hashPassword / verifyPassword", () => {
  it("verifies the password it hashed", () => {
    const stored = hashPassword("hunter22");
    expect(stored).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(verifyPassword("hunter22", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyPassword("hunter23", hashPassword("hunter22"))).toBe(false);
  });

  it("salts each hash differently", () => {
    expect(hashPassword("same-pass")).not.toBe(hashPassword("same-pass"));
  });

  it("rejects a malformed stored hash", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "bcrypt$aa$bb")).toBe(false);
  });
});

describe("isLoopbackAddress", () => {
  it.each(["127.0.0.1", "127.1.2.3", "::1", "::ffff:127.0.0.1"])("treats %s as loopback", (ip) => {
    expect(isLoopbackAddress(ip)).toBe(true);
  });

  it.each(["192.168.1.20", "::ffff:10.0.0.5", "fe80::1", "", null, undefined])("rejects %s", (ip) => {
    expect(isLoopbackAddress(ip)).toBe(false);
  });
});

describe("session store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("accepts a fresh token until it expires", () => {
    const store = createSessionStore(1000);
    const token = store.create();
    expect(store.isValid(token)).toBe(true);
    vi.advanceTimersByTime(999);
    expect(store.isValid(token)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(store.isValid(token)).toBe(false);
  });

  it("rejects unknown, missing, and revoked tokens", () => {
    const store = createSessionStore();
    const token = store.create();
    expect(store.isValid("nope")).toBe(false);
    expect(store.isValid(undefined)).toBe(false);
    store.revoke(token);
    expect(store.isValid(token)).toBe(false);
  });

  it("revokeAll ends every session", () => {
    const store = createSessionStore();
    const a = store.create();
    const b = store.create();
    store.revokeAll();
    expect(store.isValid(a) || store.isValid(b)).toBe(false);
  });
});

describe("login limiter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("blocks an IP after the failure limit within the window", () => {
    const limiter = createLoginLimiter(3, 1000);
    for (let i = 0; i < 2; i++) limiter.recordFailure("1.2.3.4");
    expect(limiter.isBlocked("1.2.3.4")).toBe(false);
    limiter.recordFailure("1.2.3.4");
    expect(limiter.isBlocked("1.2.3.4")).toBe(true);
    expect(limiter.isBlocked("5.6.7.8")).toBe(false);
  });

  it("unblocks once the failures age out of the window", () => {
    const limiter = createLoginLimiter(2, 1000);
    limiter.recordFailure("ip");
    vi.advanceTimersByTime(500);
    limiter.recordFailure("ip");
    expect(limiter.isBlocked("ip")).toBe(true);
    vi.advanceTimersByTime(501);
    expect(limiter.isBlocked("ip")).toBe(false);
  });

  it("reset clears an IP's failures", () => {
    const limiter = createLoginLimiter(1, 1000);
    limiter.recordFailure("ip");
    limiter.reset("ip");
    expect(limiter.isBlocked("ip")).toBe(false);
  });
});
