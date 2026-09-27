import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const PASSWORD_MIN_LENGTH = 6;
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 60 * 1000;

const KEY_LENGTH = 64;

// node:crypto rather than Bun.password: `bun run dev` runs Nitro under Node,
// and so does Vitest.
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isLoopbackAddress(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const address = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return address === "::1" || address.startsWith("127.");
}

export function createSessionStore(ttlMs = SESSION_TTL_MS) {
  const sessions = new Map<string, number>();
  return {
    create(): string {
      const token = randomBytes(32).toString("hex");
      sessions.set(token, Date.now() + ttlMs);
      return token;
    },
    isValid(token: string | null | undefined): boolean {
      if (!token) return false;
      const expiresAt = sessions.get(token);
      if (expiresAt === undefined) return false;
      if (expiresAt <= Date.now()) {
        sessions.delete(token);
        return false;
      }
      return true;
    },
    revoke(token: string | null | undefined): void {
      if (token) sessions.delete(token);
    },
    revokeAll(): void {
      sessions.clear();
    },
  };
}

export function createLoginLimiter(maxFailures = LOGIN_MAX_FAILURES, windowMs = LOGIN_WINDOW_MS) {
  const failures = new Map<string, number[]>();
  const recent = (ip: string) => {
    const cutoff = Date.now() - windowMs;
    const kept = (failures.get(ip) ?? []).filter((at) => at > cutoff);
    if (kept.length) failures.set(ip, kept);
    else failures.delete(ip);
    return kept;
  };
  return {
    isBlocked(ip: string): boolean {
      return recent(ip).length >= maxFailures;
    },
    recordFailure(ip: string): void {
      failures.set(ip, [...recent(ip), Date.now()]);
    },
    reset(ip: string): void {
      failures.delete(ip);
    },
  };
}
