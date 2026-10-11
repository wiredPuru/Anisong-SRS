import { describe, expect, it } from "vitest";
import { normalizeIp } from "./partyIp.ts";

describe("normalizeIp", () => {
  it("leaves a plain IPv4 address alone", () => {
    expect(normalizeIp("192.168.1.20")).toBe("192.168.1.20");
  });

  it("unwraps an IPv4-mapped IPv6 address", () => {
    expect(normalizeIp("::ffff:192.168.1.20")).toBe("192.168.1.20");
    expect(normalizeIp("::FFFF:10.0.0.7")).toBe("10.0.0.7");
  });

  it("lowercases IPv6 and drops brackets and zone ids", () => {
    expect(normalizeIp("FE80::1%en0")).toBe("fe80::1");
    expect(normalizeIp("[2001:DB8::5]")).toBe("2001:db8::5");
  });

  it("trims whitespace", () => {
    expect(normalizeIp("  10.0.0.2 ")).toBe("10.0.0.2");
  });

  it("keeps a mapped-looking value that is not an IPv4 address", () => {
    expect(normalizeIp("::ffff:abcd")).toBe("::ffff:abcd");
  });

  it.each([null, undefined, "", "   "])("returns null for %j", (value) => {
    expect(normalizeIp(value)).toBeNull();
  });
});
