import type { H3Event } from "h3";
import type { PartyGameState } from "./partyGame.ts";
import { getPartyState, onPartyChange } from "./partyStore.ts";

const HEARTBEAT_MS = 5000;

/** Streams a view of the game: now, on every change, and a 5s heartbeat. */
export function streamPartyView(event: H3Event, view: (state: PartyGameState) => unknown, onClosed?: () => void) {
  const stream = createEventStream(event);
  let lastSent = "";
  const send = (state: PartyGameState) => {
    const data = JSON.stringify(view(state));
    // Host-only changes (a position report) leave the display view identical.
    if (data === lastSent) return;
    lastSent = data;
    void stream.push(data);
  };

  const unsubscribe = onPartyChange(send);
  // A named event, so EventSource's onmessage never sees it; it only keeps
  // the front door and any proxy from closing an idle connection.
  const heartbeat = setInterval(() => void stream.push({ event: "ping", data: "" }), HEARTBEAT_MS);
  stream.onClosed(async () => {
    unsubscribe();
    clearInterval(heartbeat);
    onClosed?.();
    await stream.close();
  });

  setTimeout(() => send(getPartyState()), 0);
  return stream.send();
}
