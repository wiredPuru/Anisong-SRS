import { H3Error } from "h3";
import { getOfflineMode } from "./mediaLibrary.ts";

export class OfflineModeError extends H3Error<{ code: "OFFLINE_MODE" }> {
  readonly statusCode = 409;
  readonly statusMessage = this.message;
  readonly data = { code: "OFFLINE_MODE" as const };

  constructor() {
    super("Offline mode is enabled. Turn it off in Settings to use online features.");
    this.name = "OfflineModeError";
  }
}

export function assertOnline(): void {
  if (getOfflineMode()) throw new OfflineModeError();
}
