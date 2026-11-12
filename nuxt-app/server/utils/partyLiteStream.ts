import type { H3Event } from "h3";
import type { LiteState } from "./partyLiteGame.ts";
import { getLiteState, onLiteChange } from "./partyLiteStore.ts";

const HEARTBEAT_MS = 5000;

/** Streams a view of the game: now, on every change to that view, and a 5s heartbeat. */
export function streamLiteView(event: H3Event, view: (state: LiteState) => unknown) {
  const stream = createEventStream(event);
  let lastSent = "";
  const send = (state: LiteState) => {
    const data = JSON.stringify(view(state));
    if (data === lastSent) return;
    lastSent = data;
    void stream.push(data);
  };

  const unsubscribe = onLiteChange(send);
  // A named event, so EventSource's onmessage never sees it; it only keeps
  // the front door from closing an idle connection.
  const heartbeat = setInterval(() => void stream.push({ event: "ping", data: "" }), HEARTBEAT_MS);
  stream.onClosed(async () => {
    unsubscribe();
    clearInterval(heartbeat);
    await stream.close();
  });

  setTimeout(() => send(getLiteState()), 0);
  return stream.send();
}
