import { isLoopbackAddress } from "../../utils/partyAuth.ts";
import { getPartyPasswordHash } from "../../utils/partyHost.ts";
import { getPartyClientIp, hasPartySession } from "../../utils/partySession.ts";

export interface PartyStatus {
  hasPassword: boolean;
  loggedIn: boolean;
  isLoopback: boolean;
  displayUrl: string;
  controlUrls: string[];
}

export default defineEventHandler((event): PartyStatus => ({
  hasPassword: getPartyPasswordHash() !== null,
  loggedIn: hasPartySession(event),
  isLoopback: isLoopbackAddress(getPartyClientIp(event)),
  displayUrl: process.env.GAQ_PARTY_DISPLAY_URL ?? "",
  controlUrls: (process.env.GAQ_PARTY_CONTROL_URLS ?? "").split(",").filter(Boolean),
}));
