import { describe, expect, it } from "vitest";
import type { PartyHostState } from "~/composables/usePartyHost";
import { sampleHostState as sampleState } from "./testing/partyHostState";
import {
  BLUR_HOTKEY_PX,
  HOST_ACTIONS,
  PIXELATE_HOTKEY_PX,
  buildHostAction,
  hostActionById,
  hostActionForKey,
  hostActionKeyLabel,
  type HostActionContext,
  type HostActionId,
} from "./partyHostActions";

const noGame = { index: -1, queue: [] };

function context(): HostActionContext {
  return { lastHidingPicture: "bubbles", previewLead: 2 };
}

function run(id: HostActionId, state: PartyHostState | null, ctx = context()) {
  return buildHostAction(hostActionById(id), state, ctx);
}

describe("HOST_ACTIONS", () => {
  it("has unique ids and unique keys", () => {
    const ids = HOST_ACTIONS.map((action) => action.id);
    const keys = HOST_ACTIONS.flatMap((action) => action.keys);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("maps each hotkey to its action, ignoring case", () => {
    expect(hostActionForKey(" ")?.id).toBe("playPause");
    expect(hostActionForKey("X")?.id).toBe("pixelate");
    expect(hostActionForKey("ArrowRight")?.id).toBe("next");
    expect(hostActionForKey("ArrowLeft")?.id).toBe("previous");
    expect(hostActionForKey("d")).toBeNull();
    expect(hostActionForKey("?")).toBeNull();
  });

  it("labels the first key for display", () => {
    expect(hostActionKeyLabel(hostActionById("playPause"))).toBe("Space");
    expect(hostActionKeyLabel(hostActionById("next"))).toBe("N");
    expect(hostActionKeyLabel(hostActionById("pixelate"))).toBe("X");
  });
});

describe("buildHostAction", () => {
  it("returns null without a state", () => {
    expect(run("scoreboard", null)).toBeNull();
  });

  it("returns null for needs-game actions without a game, but still mutes and shows scores", () => {
    const idle = sampleState(noGame);
    for (const action of HOST_ACTIONS.filter((candidate) => candidate.needsGame)) {
      expect(buildHostAction(action, idle, context())).toBeNull();
    }
    expect(run("mute", idle)).toMatchObject({ type: "effects", effects: { muted: true } });
    expect(run("scoreboard", idle)).toEqual({ type: "score", op: "show", visible: true });
  });

  it("plays or pauses from the current state", () => {
    expect(run("playPause", sampleState({ playing: true }))).toEqual({ type: "pause" });
    expect(run("playPause", sampleState({ playing: false }))).toEqual({ type: "play" });
  });

  it("sends the plain transport commands", () => {
    expect(run("reveal", sampleState())).toEqual({ type: "reveal" });
    expect(run("next", sampleState())).toEqual({ type: "next" });
    expect(run("previous", sampleState())).toEqual({ type: "previous" });
    expect(run("timer", sampleState())).toEqual({ type: "timer", seconds: 15, autoReveal: true });
  });

  it("skips to the last 3 seconds, or not at all while the duration is unknown", () => {
    expect(run("skip", sampleState())).toEqual({ type: "seek", seconds: 87, skip: true });
    expect(run("skip", sampleState({ position: null }))).toBeNull();
  });

  it("toggles pixelate 0 -> 24 -> 0 and keeps the other effects", () => {
    const on = run("pixelate", sampleState({ effects: { ...sampleState().effects, blur: 5 } }));
    expect(on).toMatchObject({ type: "effects", target: "current", effects: { pixelate: PIXELATE_HOTKEY_PX, blur: 5 } });
    const off = run("pixelate", sampleState({ effects: { ...sampleState().effects, pixelate: PIXELATE_HOTKEY_PX } }));
    expect(off).toMatchObject({ effects: { pixelate: 0 } });
  });

  it("toggles blur 0 -> 14 -> 0", () => {
    expect(run("blur", sampleState())).toMatchObject({ effects: { blur: BLUR_HOTKEY_PX } });
    expect(run("blur", sampleState({ effects: { ...sampleState().effects, blur: 30 } }))).toMatchObject({ effects: { blur: 0 } });
  });

  it("hides the picture behind the last hiding picture and remembers it on the way back", () => {
    const ctx = context();
    ctx.lastHidingPicture = "music";
    expect(run("picture", sampleState(), ctx)).toMatchObject({ effects: { picture: "music" } });
    const back = run("picture", sampleState({ effects: { ...sampleState().effects, picture: "bubbles" } }), ctx);
    expect(back).toMatchObject({ effects: { picture: "video" } });
    expect(ctx.lastHidingPicture).toBe("bubbles");
  });

  it("censors the whole frame, then lifts it after the preview lead", () => {
    expect(run("censor", sampleState({ censorStyle: "black" }))).toEqual({
      type: "censor",
      censor: { boxes: [{ x: 0, y: 0, w: 1, h: 1 }], style: "black", muted: false },
    });
    const censored = sampleState({ censor: { boxes: [], style: "blur", muted: false } });
    expect(run("censor", censored)).toEqual({ type: "censor", censor: null, delay: 2 });
  });

  it("toggles the scoreboard's visibility", () => {
    const shown = sampleState({ scoreboard: { ...sampleState().scoreboard, visible: true } });
    expect(run("scoreboard", shown)).toEqual({ type: "score", op: "show", visible: false });
  });
});
