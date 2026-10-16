import type { PartyHostCommand, PartyHostState } from "~/composables/usePartyHost";
import {
  buildHostAction,
  hostActionById,
  hostActionKeyLabel,
  hostHasGame,
  type HostActionContext,
  type HostActionId,
} from "./partyHostActions";

export type PaletteGroup = "Playback" | "Screen" | "Players" | "Round" | "Show" | "Game" | "Panels";
export type PaletteKind = "toggle" | "action" | "jump";
export type HostTab = "round" | "screen" | "players" | "game";
/** Commands the dashboard handles itself, with no server command. */
export type PaletteLocalId = "help" | "ambient";

/** Page state the palette reads that is not in the party state. */
export interface PaletteLocal {
  ambientOn: boolean;
}

export interface PartyPaletteCommand {
  id: string;
  title: string;
  group: PaletteGroup;
  keywords: readonly string[];
  kind: PaletteKind;
  hotkey?: string;
  /** The `data-palette-target` a pick scrolls to. */
  target?: string;
  /** The settings tab that target lives on, when it is in the tabbed column. */
  tab?: HostTab;
  local?: PaletteLocalId;
  state?(host: PartyHostState, local: PaletteLocal): boolean;
  /** Why the command cannot run now, or null when it can. */
  available?(host: PartyHostState): string | null;
  run?(host: PartyHostState, ctx: HostActionContext): PartyHostCommand | null;
}

export const NEEDS_GAME = "Start a game first";

const needsGame = (host: PartyHostState): string | null => (hostHasGame(host) ? null : NEEDS_GAME);

function fromHostAction(
  actionId: HostActionId,
  fields: Omit<PartyPaletteCommand, "id" | "hotkey" | "run" | "available">,
): PartyPaletteCommand {
  const action = hostActionById(actionId);
  return {
    id: actionId,
    hotkey: hostActionKeyLabel(action),
    ...fields,
    available: action.needsGame ? needsGame : undefined,
    run: (host, ctx) => buildHostAction(action, host, ctx),
  };
}

function jump(id: string, title: string, keywords: readonly string[], extra: Partial<PartyPaletteCommand> = {}): PartyPaletteCommand {
  return { id: `panel-${id}`, title, group: "Panels", keywords, kind: "jump", target: id, ...extra };
}

export const PARTY_PALETTE_COMMANDS: readonly PartyPaletteCommand[] = [
  fromHostAction("playPause", { title: "Play / pause", group: "Playback", keywords: ["resume", "stop", "start"], kind: "action" }),
  fromHostAction("reveal", { title: "Reveal", group: "Playback", keywords: ["answer", "show answer"], kind: "action" }),
  fromHostAction("next", { title: "Next song", group: "Playback", keywords: ["skip", "forward"], kind: "action" }),
  fromHostAction("previous", { title: "Previous song", group: "Playback", keywords: ["back", "last"], kind: "action" }),
  fromHostAction("skip", { title: "Skip to end", group: "Playback", keywords: ["last seconds", "seek"], kind: "action" }),
  fromHostAction("timer", { title: "Start 15s timer", group: "Playback", keywords: ["countdown", "clock"], kind: "action" }),
  fromHostAction("pixelate", {
    title: "Pixelate",
    group: "Screen",
    keywords: ["pixel", "mosaic", "effect"],
    kind: "toggle",
    target: "effects-pixelate",
    tab: "screen",
    state: (host) => host.effects.pixelate > 0,
  }),
  fromHostAction("blur", {
    title: "Blur",
    group: "Screen",
    keywords: ["fuzzy", "effect"],
    kind: "toggle",
    target: "effects-blur",
    tab: "screen",
    state: (host) => host.effects.blur > 0,
  }),
  fromHostAction("mute", {
    title: "Mute",
    group: "Screen",
    keywords: ["sound", "audio", "silence", "volume"],
    kind: "toggle",
    target: "effects-mute",
    tab: "screen",
    state: (host) => host.effects.muted,
  }),
  fromHostAction("picture", {
    title: "Hide picture",
    group: "Screen",
    keywords: ["bubbles", "music player", "video", "blind"],
    kind: "toggle",
    target: "effects",
    tab: "screen",
    state: (host) => host.effects.picture !== "video",
  }),
  fromHostAction("censor", {
    title: "Censor whole screen",
    group: "Screen",
    keywords: ["lift censor", "cover", "hide screen"],
    kind: "toggle",
    target: "censor",
    state: (host) => host.censor !== null,
  }),
  fromHostAction("scoreboard", {
    title: "Show scoreboard",
    group: "Players",
    keywords: ["scores", "points", "standings"],
    kind: "toggle",
    target: "scoreboard",
    state: (host) => host.scoreboard.visible,
  }),
  {
    id: "buzzer",
    title: "Buzzer mode",
    group: "Players",
    keywords: ["buzz", "phones"],
    kind: "toggle",
    target: "option-buzzer",
    state: (host) => host.buzzerEnabled,
    run: (host) => ({ type: "buzzer", enabled: !host.buzzerEnabled }),
  },
  {
    id: "joinInfo",
    title: "Show join info on screen",
    group: "Players",
    keywords: ["join address", "players join", "link"],
    kind: "toggle",
    target: "join-info",
    tab: "players",
    state: (host) => host.joinInfoVisible,
    run: (host) => ({ type: "joinInfo", visible: !host.joinInfoVisible }),
  },
  {
    id: "randomStart",
    title: "Random start",
    group: "Round",
    keywords: ["random point", "start time"],
    kind: "toggle",
    target: "option-random-start",
    state: (host) => host.randomStart,
    run: (host) => ({ type: "settings", randomStart: !host.randomStart }),
  },
  {
    id: "autoAdvance",
    title: "Go to the next song when one ends",
    group: "Round",
    keywords: ["auto advance", "autoplay", "continue"],
    kind: "toggle",
    target: "option-auto-advance",
    state: (host) => host.autoAdvance,
    run: (host) => ({ type: "autoAdvance", enabled: !host.autoAdvance }),
  },
  {
    id: "summary",
    title: "Show results",
    group: "Round",
    keywords: ["summary", "standings", "end screen"],
    kind: "toggle",
    target: "now-playing",
    state: (host) => host.summaryVisible,
    available: needsGame,
    run: (host) => ({ type: "summary", visible: !host.summaryVisible }),
  },
  {
    id: "music",
    title: "Lobby music",
    group: "Show",
    keywords: ["background music", "playlist"],
    kind: "toggle",
    target: "music",
    tab: "screen",
    state: (host) => host.music.enabled,
    run: (host) => ({ type: "music", ...host.music, enabled: !host.music.enabled }),
  },
  { id: "help", title: "Shortcuts list", group: "Game", keywords: ["hotkeys", "keys", "help"], kind: "action", hotkey: "?", local: "help" },
  {
    id: "ambient",
    title: "Ambient glow",
    group: "Game",
    keywords: ["background", "glow"],
    kind: "toggle",
    local: "ambient",
    state: (_host, local) => local.ambientOn,
  },
  jump("add-songs", "Add songs", ["add show", "search", "queue a song", "find"]),
  jump("queue", "Queue", ["songs", "playlist", "order"], { available: needsGame }),
  jump("now-playing", "Now playing", ["current song", "transport"]),
  jump("censor", "Preview and censor", ["censor boxes", "preview"], { available: needsGame }),
  jump("scoreboard", "Scoreboard", ["players", "scores", "teams"]),
  jump("rules", "Rules", ["game rules"]),
  jump("lightning", "Lightning round", ["lightning", "fast round"], { tab: "round" }),
  jump("live", "Help this song", ["hints", "clues", "live"], { tab: "round" }),
  jump("effects", "Effects", ["screen effects", "picture"], { tab: "screen" }),
  jump("reveal-fields", "Show on reveal", ["reveal fields", "answer"], { tab: "screen" }),
  jump("show", "Show (timer, banner, music)", ["timer", "banner", "music"], { tab: "screen" }),
  jump("join", "Players join at", ["join", "phones", "address"], { tab: "players" }),
  jump("connect", "Connect a display or phone", ["display link", "host link", "url"], { tab: "players" }),
  jump("new-game", "New game", ["build game", "load", "deck"], { tab: "game" }),
  jump("endless", "Endless playlist", ["endless", "infinite"], { tab: "game" }),
];

export const PALETTE_SHORTCUT_LABEL = "Shift+P";

/** Shift+P, with no other modifier; Cmd/Ctrl+P stays the browser's Print. */
export function isPaletteShortcut(event: Pick<KeyboardEvent, "key" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey">): boolean {
  return event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "p";
}

export function paletteCommandById(id: string): PartyPaletteCommand | null {
  return PARTY_PALETTE_COMMANDS.find((command) => command.id === id) ?? null;
}
