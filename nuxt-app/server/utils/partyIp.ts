/**
 * The form a client address is compared and banned in: lowercase, no brackets or
 * zone id, and an IPv4-mapped IPv6 address (`::ffff:1.2.3.4`) as plain IPv4, so
 * one phone is one address however the socket reported it.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  let ip = (raw ?? "").trim().toLowerCase();
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  ip = ip.replace(/%.*$/, "");
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) ip = mapped[1]!;
  return ip || null;
}
