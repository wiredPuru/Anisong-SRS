import { getPartyState, runPartyCommand } from "../../../utils/partyStore.ts";

// A tap on the screen itself pauses or resumes the current song.
export default defineEventHandler(() => {
  const state = getPartyState();
  if (state.phase === "idle") return { playing: false };
  runPartyCommand({ type: state.playing ? "pause" : "play" });
  return { playing: !state.playing };
});
