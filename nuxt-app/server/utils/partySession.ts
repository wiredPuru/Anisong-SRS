import type { H3Event } from "h3";
import { PARTY_CLIENT_IP_HEADER, PARTY_DOOR_HEADER, PARTY_SESSION_COOKIE, parsePartyDoor, type PartyDoor } from "./partyAccess.ts";
import { SESSION_TTL_MS, createLoginLimiter, createSessionStore } from "./partyAuth.ts";

// In memory on purpose: a restart ends every host login.
export const partySessions = createSessionStore();
export const partyLoginLimiter = createLoginLimiter();

export function isPartyEnabled(): boolean {
  return process.env.GAQ_PARTY === "1";
}

export function getPartyDoor(event: H3Event): PartyDoor | null {
  return parsePartyDoor(getHeader(event, PARTY_DOOR_HEADER));
}

// Set by the launcher's front doors, which overwrite any incoming value.
// Nitro itself only listens on loopback, so nothing else can reach it.
export function getPartyClientIp(event: H3Event): string | null {
  return getHeader(event, PARTY_CLIENT_IP_HEADER) ?? null;
}

export function hasPartySession(event: H3Event): boolean {
  return partySessions.isValid(getCookie(event, PARTY_SESSION_COOKIE));
}

export function startPartySession(event: H3Event): void {
  setCookie(event, PARTY_SESSION_COOKIE, partySessions.create(), {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function endPartySession(event: H3Event): void {
  partySessions.revoke(getCookie(event, PARTY_SESSION_COOKIE));
  deleteCookie(event, PARTY_SESSION_COOKIE, { path: "/" });
}
