import { randomBytes } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { getCardsByIds } from "./cards.ts";
import { EMPTY_ANSWER_FACTS, parseAnimeVintage, partyAnswerFacts } from "./partyAnswerFacts.ts";
import { fetchAnimeDetailsByIds } from "../lib/anilist.ts";
import { AnisongUnknownLabelsError, toThemeSlot, type AnisongRandomSong, type AnisongSongResult } from "../lib/anisongdb.ts";
import { catalogSongFilters, withoutLabels } from "./partyCatalogFilters.ts";
import { noteCatalogShows, pickCatalogSongs, resetCatalogPicker } from "./partyCatalogPicker.ts";
import { currentRanking } from "./popularityRanking.ts";
import { getClipSource, getDefaultDownloadFolder, getIncludeInsertSongs, getPartyAutoDownload, getPlaybackMode } from "./mediaLibrary.ts";
import { downloadCatalogClip, selectDownloadTargets, withLocalClip } from "./partyDownload.ts";
import { isStreamCached, resolveCachedPath } from "./streamCache.ts";
import { findAlternateClip } from "./partySourceSwap.ts";
import { isClipUrlAllowed } from "./clipSource.ts";
import { pickChoices, type ChoiceCandidate } from "./partyChoices.ts";
import { ENDLESS_AHEAD, ENDLESS_BATCH, ENDLESS_CATALOG_BATCH, pickEndlessBatch } from "./partyEndless.ts";
import { listEndlessCandidates } from "./partySources.ts";
import { loadSavedRules, storeSavedRules } from "./partyRulesStore.ts";
import { popularityCutoffs } from "./popularityCutoffs.ts";
import { getOfflineMode } from "./mediaLibrary.ts";
import { assertOnline } from "./networkMode.ts";
import { localMediaAvailable } from "./localMedia.ts";
import { parseStudyFilters, type StudyFilters } from "./studyFilters.ts";
import { EMPTY_DETAILS, type PartyAnimeDetails } from "./partyLightning.ts";
import { createPlayerRegistry } from "./partyPlayers.ts";
import {
  applyPartyCommand,
  currentPartyItem,
  initialPartyState,
  lightningStep,
  PARTY_LOAD_MAX,
  PARTY_LOOKAHEAD,
  listPartyClips,
  nextPartyClip,
  pickPartyClip,
  shouldRevealEarly,
  withClipStatus,
  timerMayReveal,
  toQueueItem,
  upcomingCardIds,
  type PartyAddPosition,
  type PartyCatalogNote,
  type PartyCommand,
  type PartyGameState,
  type PartyJoinInfo,
  type PartyPosition,
  type PartyQueueItem,
} from "./partyGame.ts";

// One game per party process, in memory: a restart ends it.
let state: PartyGameState = initialPartyState();
const listeners = new Set<(state: PartyGameState) => void>();

// The saved rules join the state on first use, once the database is ready.
let rulesLoaded = false;
function ensureRulesLoaded(): void {
  if (rulesLoaded) return;
  rulesLoaded = true;
  const saved = loadSavedRules();
  if (saved) state = applyPartyCommand(state, { type: "rules", text: saved });
}

export function getPartyState(): PartyGameState {
  ensureRulesLoaded();
  return state;
}

export function onPartyChange(listener: (state: PartyGameState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// A remote clip plays only once the stream cache holds all of it, so the
// current song and the ones the display buffers ahead are fetched as soon as
// the game moves. Failures are the clip route's to report.
function prefetchAround(current: PartyGameState): void {
  if (getOfflineMode()) return;
  for (const item of current.queue.slice(Math.max(current.index, 0), current.index + 1 + PARTY_LOOKAHEAD)) {
    if (getOfflineMode()) return;
    fetchClip(item);
  }
}

// Fetches a remote clip into the stream cache, showing the host it is on its
// way and whether it failed. A cached or local clip needs nothing.
function fetchClip(item: PartyQueueItem): void {
  const { source } = item.clip;
  if (source.type !== "remote" || isStreamCached(source.url)) return;
  commit(withClipStatus(state, item.token, "fetching"));
  void resolveCachedPath(source.url)
    .then((result) => commit(withClipStatus(state, item.token, "error" in result ? "failed" : null)))
    .catch(() => commit(withClipStatus(state, item.token, "failed")));
}

/** Gives a playing or upcoming song a fresh try: a new token, so the display reloads it. */
function retryQueueItem(index: number): void {
  const item = state.queue[index];
  if (!item || index < Math.max(state.index, 0)) return;
  const replacement = { ...item, token: randomBytes(12).toString("hex") };
  commit(applyPartyCommand(state, { type: "queueClip", index }, { loaded: [replacement] }));
  if (!getOfflineMode()) fetchClip(replacement);
}

/**
 * Looks the song up at the other provider (AnisongDB or AnimeThemes) and plays
 * that clip instead. The host asked for it, so it plays even where the Clip
 * source setting would exclude that provider. Party only: no card changes.
 */
async function swapQueueSource(index: number): Promise<void> {
  const item = state.queue[index];
  if (!item || index < Math.max(state.index, 0) || getOfflineMode()) return;
  const { aniListId } = item;
  if (aniListId === undefined) return;
  const { token } = item;
  commit(withClipStatus(state, token, "fetching"));
  let clip: PartyQueueItem["clip"] | null = null;
  try {
    clip = await findAlternateClip({ aniListId, songTitle: item.answer.songTitle, current: item.clip, audioOnly: getPlaybackMode() === "audioOnly" });
  } catch {
    clip = null;
  }
  // The queue may have moved while this was out; the song is found by its token.
  const at = state.queue.findIndex((queued) => queued.token === token);
  if (at < Math.max(state.index, 0)) return;
  if (!clip || clip.source.type !== "remote") {
    commit(withClipStatus(state, token, "noSource"));
    return;
  }
  const { clipOverride: _previous, ...current } = state.queue[at]!;
  const override = !isClipUrlAllowed(clip.source.url, getClipSource());
  const replacement: PartyQueueItem = { ...current, clip, token: randomBytes(12).toString("hex"), ...(override ? { clipOverride: true } : {}) };
  commit(applyPartyCommand(state, { type: "queueClip", index: at }, { loaded: [replacement] }));
  fetchClip(replacement);
}

const downloadAttempted = new Set<string>();
let downloading = false;

// Catalog songs have no card, so Study's Auto Download never reaches them.
// Runs one at a time, and a finished file only replaces a song that has not started.
async function downloadUpcoming(): Promise<void> {
  if (downloading || getOfflineMode() || !getPartyAutoDownload()) return;
  const folder = getDefaultDownloadFolder();
  if (!folder) return;
  downloading = true;
  try {
    for (let next = selectDownloadTargets(state, downloadAttempted)[0]; next; next = selectDownloadTargets(state, downloadAttempted)[0]) {
      if (getOfflineMode()) return;
      downloadAttempted.add(next.token);
      const clip = await downloadCatalogClip(next, folder);
      if (clip) commit(withLocalClip(state, next.token, clip));
    }
  } finally {
    downloading = false;
  }
}

let timerHandle: ReturnType<typeof setTimeout> | null = null;

// An auto-reveal timer fires on the server, so it lands even if the host's
// phone sleeps. Any new timer, a stop, or a move replaces the timer object,
// which is what the check below compares against.
function scheduleTimer(): void {
  if (timerHandle) clearTimeout(timerHandle);
  timerHandle = null;
  const timer = state.timer;
  if (!timer?.autoReveal) return;
  timerHandle = setTimeout(() => {
    timerHandle = null;
    // A player answering holds the reveal; judging them Wrong lands it.
    if (state.timer === timer && state.phase === "guessing" && timerMayReveal(state)) {
      commit(applyPartyCommand(state, { type: "reveal" }));
    }
  }, Math.max(0, timer.endsAt - Date.now()));
}

let toppingUp = false;
let fetchingCatalog = false;
let staleCatalogBatch = false;
// Bumped by every endless command, so a fetch that outlived its filters is dropped.
let catalogGeneration = 0;

// A song straight from AnisongDB has no card behind it, so its id is the
// negated AMQ song id: unique, and never colliding with a library card.
interface CatalogSong {
  annSongId: number;
  themeSlot: string;
  songTitle: string;
  artistName: string;
  animeEnglish: string;
  animeRomaji: string;
  videoUrl: string | null;
  audioUrl: string | null;
  aniListId: number | null;
  /** AMQ's season label, e.g. "Fall 2013", when the source gives one. */
  animeVintage?: string | null;
}

function catalogItem(song: CatalogSong): PartyQueueItem | null {
  const clip = pickPartyClip(
    { localVideoPath: null, localAudioPath: null, animethemesVideoUrl: song.videoUrl, animethemesAudioUrl: song.audioUrl },
    { clipSource: getClipSource(), playbackMode: getPlaybackMode() },
  );
  if (!clip) return null;
  return {
    token: randomBytes(12).toString("hex"),
    cardId: -song.annSongId,
    clip,
    details: EMPTY_DETAILS,
    ...(song.aniListId !== null ? { aniListId: song.aniListId } : {}),
    answer: {
      animeTitleEnglish: song.animeEnglish,
      animeTitleRomaji: song.animeRomaji,
      animeTitleNative: song.animeRomaji,
      songTitle: song.songTitle,
      artistName: song.artistName,
      themeSlot: song.themeSlot,
      coverImageUrl: null,
      // Season and year now; format, studios and the rest arrive with fillCatalogFacts.
      facts: { ...EMPTY_ANSWER_FACTS, ...parseAnimeVintage(song.animeVintage) },
    },
  };
}

function fromRandom(song: AnisongRandomSong): PartyQueueItem | null {
  const themeSlot = toThemeSlot(song.songType) ?? (getIncludeInsertSongs() ? `IN-${song.annSongId}` : null);
  return themeSlot ? catalogItem({ ...song, themeSlot }) : null;
}

// The last catalog search, so adding a result needs no second AnisongDB call.
let lastCatalogSearch = new Map<number, CatalogSong>();

export function rememberCatalogSearch(results: AnisongSongResult[]): void {
  lastCatalogSearch = new Map(
    results.map((song) => [
      song.annSongId,
      { ...song, artistName: song.artistName ?? "Unknown artist", animeEnglish: song.animeTitleRomaji, animeRomaji: song.animeTitleRomaji, aniListId: song.animeAniListId },
    ]),
  );
}

/** Adds songs from the last catalog search to the queue; the count actually added. */
export function addCatalogSongs(annSongIds: number[], position: PartyAddPosition = "end"): { loaded: number; moved: number } {
  assertOnline();
  const upcoming = upcomingCardIds(state);
  const currentId = state.queue[state.index]?.cardId;
  const songs = annSongIds.map((id) => lastCatalogSearch.get(id)).filter((song) => song !== undefined);
  const items = songs
    .map(catalogItem)
    .filter((item): item is PartyQueueItem => item !== null && item.cardId !== currentId && !upcoming.has(item.cardId))
    .map((item) => (state.index >= 0 ? { ...item, manual: true } : item))
    .slice(0, Math.max(0, PARTY_LOAD_MAX - state.queue.length));
  // A song can only be waiting if it was found before, so its id is known.
  const moved = annSongIds.filter((id) => upcoming.has(-id)).length;
  if (!items.length && !moved) return { loaded: 0, moved: 0 };
  const cardIds = annSongIds.map((id) => -id);
  commit(
    applyPartyCommand(
      state,
      { type: "load", cardIds, shuffle: false, downloadedOnly: false, append: true, position },
      { loaded: items },
    ),
  );
  return { loaded: items.length, moved };
}

// Genres and tags AnisongDB refused for the current endless filters.
let unknownCatalogLabels = new Set<string>();

function setCatalogNote(change: Partial<PartyCatalogNote>): void {
  if (!state.endless?.outsideLibrary) return;
  const note: PartyCatalogNote = { notApplied: [], unknownLabels: [], noMatch: false, rankingUnavailable: false, ...state.endless.catalogNote, ...change };
  commit({ ...state, endless: { ...state.endless, catalogNote: note } });
}

// One fetch per kind AnisongDB can refuse (genres, then tags), plus two more
// tries when a season subset leaves nothing from a batch.
const CATALOG_ATTEMPTS = 4;

/** AMQ song ids already in the queue; catalog items carry the negated id. */
function queuedAnnSongIds(): Set<number> {
  return new Set(state.queue.filter((item) => item.cardId < 0).map((item) => -item.cardId));
}

interface CatalogBatch {
  result: PartyQueueItem[] | "noMatch";
  usedRanking: boolean;
}

async function fetchCatalogBatch(count: number): Promise<CatalogBatch> {
  const tier = state.endless?.difficulty ?? "random";
  const { options, seasons } = catalogSongFilters(endlessFilters, getIncludeInsertSongs());
  let usedRanking = tier === "random";
  for (let attempt = 0; attempt < CATALOG_ATTEMPTS; attempt++) {
    const queued = queuedAnnSongIds();
    let pick;
    try {
      pick = await pickCatalogSongs({ tier, options: withoutLabels(options, unknownCatalogLabels), seasons, queued, count });
    } catch (error) {
      if (!(error instanceof AnisongUnknownLabelsError)) throw error;
      for (const label of error.labels) unknownCatalogLabels.add(label);
      continue;
    }
    usedRanking = pick.usedRanking || tier === "random";
    if (pick.noMatch) return { result: "noMatch", usedRanking };
    const items = pick.songs.map(fromRandom).filter((item): item is PartyQueueItem => item !== null && !queued.has(-item.cardId));
    if (items.length) {
      noteCatalogShows(pick.songs);
      return { result: items, usedRanking };
    }
  }
  return { result: [], usedRanking };
}

async function topUpCatalog(hasGame: boolean): Promise<void> {
  if (getOfflineMode()) return;
  fetchingCatalog = true;
  const generation = catalogGeneration;
  try {
    const { result, usedRanking } = await fetchCatalogBatch(ENDLESS_CATALOG_BATCH);
    // The host may have stopped endless, switched source or changed the filters while this was out.
    if (!state.endless?.outsideLibrary) return;
    if (catalogGeneration !== generation) {
      staleCatalogBatch = true;
      return;
    }
    const unknownLabels = [...unknownCatalogLabels];
    const rankingUnavailable = !usedRanking;
    if (result === "noMatch") {
      setCatalogNote({ noMatch: true, unknownLabels, rankingUnavailable });
      return;
    }
    const note = state.endless.catalogNote;
    if (unknownLabels.length !== (note?.unknownLabels.length ?? 0) || rankingUnavailable !== (note?.rankingUnavailable ?? false)) {
      setCatalogNote({ unknownLabels, rankingUnavailable });
    }
    if (!result.length) return;
    const stillHasGame = state.index >= 0 && state.index < state.queue.length;
    commit(
      applyPartyCommand(
        state,
        { type: "load", cardIds: result.map((item) => item.cardId), shuffle: false, downloadedOnly: false, append: hasGame && stillHasGame },
        { loaded: result },
      ),
    );
  } catch {
    // AnisongDB being down just means no new songs this round; the next change retries.
  } finally {
    fetchingCatalog = false;
    // The change that made this batch stale already tried to top up and was blocked by this fetch.
    if (staleCatalogBatch) {
      staleCatalogBatch = false;
      topUpEndless();
    }
  }
}

// The filters an endless queue draws under. They can carry thousands of list
// ids, so they live here rather than in the state every client receives.
let endlessFilters: StudyFilters | null = null;
// What the running endless queue was last set to, so a resend of the same settings keeps its songs.
// Catalog songs ignore the deck, so a deck change alone keeps them too.
let endlessKey: string | null = null;

// An endless queue keeps a few songs ready ahead of the current one. It runs
// after every change, so a skip, a jump or a removal refills it too.
function topUpEndless(): void {
  const config = state.endless;
  if (!config || toppingUp) return;
  const hasGame = state.index >= 0 && state.index < state.queue.length;
  const upcoming = hasGame ? state.queue.length - 1 - state.index : 0;
  if (hasGame && upcoming >= ENDLESS_AHEAD) return;
  if (state.queue.length >= PARTY_LOAD_MAX) return;
  if (config.outsideLibrary) {
    // No match waits for new filters rather than asking AnisongDB again.
    if (!fetchingCatalog && !config.catalogNote?.noMatch) void topUpCatalog(hasGame);
    return;
  }
  toppingUp = true;
  try {
    // A few spare picks cover songs the clip settings drop.
    const cardIds = pickEndlessBatch({
      candidates: listEndlessCandidates(config.scope, endlessFilters),
      cutoffs: popularityCutoffs(),
      difficulty: config.difficulty,
      downloadedOnly: config.downloadedOnly,
      queue: state.queue.map((item) => item.cardId),
      count: ENDLESS_BATCH + 4,
    });
    if (!cardIds.length) return;
    runPartyCommand({ type: "load", cardIds, append: hasGame, downloadedOnly: config.downloadedOnly }, "endless");
  } finally {
    toppingUp = false;
  }
}

function commit(next: PartyGameState): void {
  if (next === state) return;
  const moved = next.index !== state.index || next.queue !== state.queue;
  const timerChanged = next.timer !== state.timer;
  state = next;
  if (moved) {
    prefetchAround(state);
    void downloadUpcoming();
  }
  if (timerChanged) scheduleTimer();
  for (const listener of listeners) listener(state);
  topUpEndless();
  if (moved) void fillCatalogFacts();
}

interface CatalogShowFacts {
  details: PartyAnimeDetails;
  studios: string[];
}
// Facts for catalog songs' shows, kept for the session; null means AniList had none.
const catalogShowFacts = new Map<number, CatalogShowFacts | null>();
let fillingFacts = false;

function catalogIdsWithoutFacts(): number[] {
  const ids = state.queue.flatMap((item) => (item.cardId < 0 && item.aniListId !== undefined && !catalogShowFacts.has(item.aniListId) ? [item.aniListId] : []));
  return [...new Set(ids)];
}

// A show already in the library has its details stored, so it needs no AniList call.
function storedShowFacts(aniListIds: number[]): Map<number, CatalogShowFacts> {
  const rows = db
    .select({
      aniListId: anime.aniListId,
      year: anime.year,
      season: anime.season,
      format: anime.format,
      averageScore: anime.averageScore,
      genres: anime.genres,
      tags: anime.tags,
      studios: anime.studios,
      checkedAt: anime.aniListDetailsCheckedAt,
    })
    .from(anime)
    .where(inArray(anime.aniListId, aniListIds))
    .all();
  return new Map(rows.filter((row) => row.checkedAt !== null).map(({ aniListId, studios, checkedAt: _checked, ...details }) => [aniListId, { details, studios }]));
}

/**
 * Catalog songs arrive with only AMQ's season label. This fills in format,
 * studios, score and tags for the reveal (and lightning hints), from the
 * library when it has the show, else one batched AniList request.
 */
async function fillCatalogFacts(): Promise<void> {
  if (fillingFacts) return;
  const missing = catalogIdsWithoutFacts();
  if (!missing.length) return;
  fillingFacts = true;
  try {
    for (const [id, facts] of storedShowFacts(missing)) catalogShowFacts.set(id, facts);
    const remote = missing.filter((id) => !catalogShowFacts.has(id));
    if (remote.length && !getOfflineMode()) {
      const fetched = await fetchAnimeDetailsByIds(remote);
      for (const id of remote) {
        const found = fetched.get(id);
        catalogShowFacts.set(id, found ? { details: found, studios: found.studios } : null);
      }
    }
  } catch {
    // AniList being down leaves these songs with their season and year only.
  } finally {
    fillingFacts = false;
  }
  applyCatalogFacts();
  // Songs queued while this was out; ids just tried and not found are cached, so this ends.
  if (!getOfflineMode() && catalogIdsWithoutFacts().some((id) => !missing.includes(id))) void fillCatalogFacts();
}

function applyCatalogFacts(): void {
  let changed = false;
  const queue = state.queue.map((item) => {
    const found = item.cardId < 0 && item.aniListId !== undefined ? catalogShowFacts.get(item.aniListId) : undefined;
    if (!found || item.details !== EMPTY_DETAILS) return item;
    changed = true;
    const facts = partyAnswerFacts(found.details, found.studios);
    const { year, season } = item.answer.facts;
    return {
      ...item,
      details: found.details,
      answer: { ...item.answer, facts: { ...facts, year: facts.year ?? year, season: facts.season ?? season } },
    };
  });
  if (changed) commit({ ...state, queue, version: state.version + 1 });
}

function localFileUsable(path: string): boolean {
  return localMediaAvailable(path);
}

function loadAnimeDetails(animeIds: number[]): Map<number, PartyAnimeDetails> {
  if (!animeIds.length) return new Map();
  const rows = db
    .select({
      id: anime.id,
      year: anime.year,
      season: anime.season,
      format: anime.format,
      averageScore: anime.averageScore,
      genres: anime.genres,
      tags: anime.tags,
    })
    .from(anime)
    .where(inArray(anime.id, [...new Set(animeIds)]))
    .all();
  return new Map(rows.map(({ id, ...details }) => [id, details]));
}

function resolveQueue(cardIds: number[], downloadedOnly: boolean): { items: PartyQueueItem[]; skipped: number } {
  const settings = { clipSource: getClipSource(), playbackMode: getPlaybackMode(), downloadedOnly, offlineMode: getOfflineMode() };
  const cards = getCardsByIds(cardIds);
  const byId = new Map(cards.map((card) => [card.id, card]));
  const details = loadAnimeDetails(cards.map((card) => card.animeId));
  const items: PartyQueueItem[] = [];
  for (const id of cardIds) {
    const card = byId.get(id);
    const clip = card ? pickPartyClip(card, settings, localFileUsable) : null;
    if (card && clip) {
      items.push(toQueueItem(card, clip, randomBytes(12).toString("hex"), details.get(card.animeId) ?? EMPTY_DETAILS));
    }
  }
  return { items, skipped: cardIds.length - items.length };
}

// Decoy titles come from every show in the library, so a catalog song still
// gets real options even though it has no card.
function choicesFor(item: PartyQueueItem): string[] {
  const rows = db
    .select({
      title: anime.titleEnglish,
      year: anime.year,
      season: anime.season,
      format: anime.format,
      averageScore: anime.averageScore,
      genres: anime.genres,
      tags: anime.tags,
    })
    .from(anime)
    .all();
  const candidates: ChoiceCandidate[] = rows.map(({ title, ...details }) => ({ title, details }));
  return pickChoices(item.answer.animeTitleEnglish, item.details, candidates, item.token);
}

export function runPartyCommand(command: PartyCommand, origin: "host" | "endless" = "host"): { loaded?: number; moved?: number; skipped?: number; changed?: boolean } {
  ensureRulesLoaded();
  if (command.type === "rules") storeSavedRules(command.text);
  if (command.type === "choices" && command.enabled) {
    const item = currentPartyItem(state);
    commit(applyPartyCommand(state, command, { choices: item ? choicesFor(item) : undefined }));
    return {};
  }
  if (command.type === "endless") {
    if (command.config?.outsideLibrary) assertOnline();
    const parsed = parseStudyFilters(command.filters);
    endlessFilters = "error" in parsed ? null : parsed.filters;
    catalogGeneration++;
    unknownCatalogLabels = new Set();
    resetCatalogPicker();
    // Start loading the popularity ranking now, so it is usually ready by the second batch.
    if (command.config?.outsideLibrary && command.config.difficulty !== "random") currentRanking();
    const { filters, config, ...plain } = command;
    const key = config
      ? JSON.stringify([config.difficulty, config.downloadedOnly, config.outsideLibrary, config.outsideLibrary ? null : config.scope, filters ?? null])
      : null;
    const keepUpcoming = key !== null && key === endlessKey;
    endlessKey = key;
    const catalogNote: PartyCatalogNote | null = config?.outsideLibrary
      ? { notApplied: catalogSongFilters(endlessFilters, false).notApplied, unknownLabels: [], noMatch: false, rankingUnavailable: false }
      : null;
    commit(applyPartyCommand(state, { ...plain, config: config ? { ...config, catalogNote } : null }, { keepUpcoming }));
    return {};
  }
  if (command.type === "queueReroll") return rerollQueueItem(command.index);
  if (command.type === "queueRetry") {
    retryQueueItem(command.index);
    return {};
  }
  if (command.type === "queueSwapSource") {
    void swapQueueSource(command.index);
    return {};
  }
  if (command.type === "changeSource") return { changed: changeCurrentSource() };
  if (command.type !== "load") {
    commit(applyPartyCommand(state, command));
    return {};
  }
  const hasGame = state.index >= 0 && state.index < state.queue.length;
  if (command.append && hasGame) return placeCards(command, origin);
  const { items, skipped } = resolveQueue(command.cardIds, command.downloadedOnly === true);
  commit(applyPartyCommand(state, command, { loaded: items }));
  return { loaded: items.length, skipped };
}

/** After a card's clip is saved locally, its copies still waiting in the queue play the file. */
export function playDownloadedCard(cardId: number): void {
  const card = getCardsByIds([cardId])[0];
  if (!card) return;
  const settings = { clipSource: getClipSource(), playbackMode: getPlaybackMode(), offlineMode: getOfflineMode() };
  const clip = pickPartyClip(card, settings, localFileUsable);
  if (clip?.source.type !== "local") return;
  let next = state;
  for (const item of state.queue.slice(state.index + 1)) {
    if (item.cardId === cardId && item.clip.source.type === "remote") next = withLocalClip(next, item.token, clip);
  }
  if (next !== state) commit(next);
}

// Songs already waiting are moved rather than re-resolved, and the song on
// screen is left alone, so the counts describe what actually happened.
function placeCards(command: Extract<PartyCommand, { type: "load" }>, origin: "host" | "endless"): { loaded: number; moved: number; skipped: number } {
  const upcoming = upcomingCardIds(state);
  const currentId = state.queue[state.index]?.cardId;
  const wanted = command.cardIds.filter((id) => id !== currentId);
  const fresh = wanted.filter((id) => !upcoming.has(id)).slice(0, Math.max(0, PARTY_LOAD_MAX - state.queue.length));
  const moved = wanted.filter((id) => upcoming.has(id)).length;
  if (!fresh.length && !moved) return { loaded: 0, moved: 0, skipped: 0 };
  const { items, skipped } = fresh.length ? resolveQueue(fresh, command.downloadedOnly === true) : { items: [], skipped: 0 };
  const manual = origin === "host";
  commit(applyPartyCommand(state, command, { loaded: manual ? items.map((item) => ({ ...item, manual })) : items }));
  return { loaded: items.length, moved, skipped };
}

// Moves the song on screen to its next playable clip (local file, stream, video,
// audio), for a clip that is slow or will not play. A song straight from the
// catalog has only the one clip it was added with.
function changeCurrentSource(): boolean {
  const item = currentPartyItem(state);
  if (!item || item.cardId <= 0) return false;
  const card = getCardsByIds([item.cardId])[0];
  if (!card) return false;
  const clips = listPartyClips(card, { clipSource: getClipSource(), playbackMode: getPlaybackMode(), offlineMode: getOfflineMode() }, localFileUsable);
  const clip = nextPartyClip(clips, item.clip);
  if (!clip) return false;
  commit(applyPartyCommand(state, { type: "changeSource" }, { loaded: [{ ...item, clip, token: randomBytes(12).toString("hex") }] }));
  return true;
}

// Swaps an upcoming song for another pick, following the endless settings when
// they are on and otherwise drawing from the whole library.
function rerollQueueItem(index: number): { loaded: number } {
  if (!(index > state.index && index < state.queue.length)) return { loaded: 0 };
  const config = state.endless;
  if (config?.outsideLibrary) {
    void rerollCatalogItem(index);
    return { loaded: 0 };
  }
  const downloadedOnly = config?.downloadedOnly ?? false;
  const cardIds = pickEndlessBatch({
    candidates: listEndlessCandidates(config?.scope, config ? endlessFilters : null),
    cutoffs: popularityCutoffs(),
    difficulty: config?.difficulty ?? "random",
    downloadedOnly,
    queue: state.queue.map((item) => item.cardId),
    count: 6,
  });
  const { items } = resolveQueue(cardIds, downloadedOnly);
  if (!items.length) return { loaded: 0 };
  commit(applyPartyCommand(state, { type: "queueReroll", index }, { loaded: items.slice(0, 1) }));
  return { loaded: 1 };
}

async function rerollCatalogItem(index: number): Promise<void> {
  try {
    const generation = catalogGeneration;
    const { result } = await fetchCatalogBatch(1);
    if (catalogGeneration !== generation || result === "noMatch" || !result.length) return;
    commit(applyPartyCommand(state, { type: "queueReroll", index }, { loaded: result.slice(0, 1) }));
  } catch {
    // The song stays when AnisongDB cannot answer.
  }
}

// Phones joining through the player door (feature 90a).
export const partyPlayers = createPlayerRegistry({
  getPlayers: () => state.scoreboard.players,
  apply: (command) => commit(applyPartyCommand(state, command)),
});

export function partyJoinInfo(): PartyJoinInfo {
  const urls = (process.env.GAQ_PARTY_PLAYER_URLS ?? "").split(",").filter(Boolean);
  return { urls };
}

/** A phone's buzz; true when it made that player the one answering. */
export function buzzParty(playerId: number): boolean {
  commit(applyPartyCommand(state, { type: "buzz", playerId }));
  return state.buzz.playerId === playerId;
}

/** A phone's multiple-choice pick; true when it was recorded as that player's answer. */
export function pickPartyChoice(playerId: number, index: number): boolean {
  commit(applyPartyCommand(state, { type: "choicePick", playerId, index }));
  return state.choicePicks[playerId] === index;
}

/** Carries a card edit into the running queue so the host list shows it. */
export function applyPartyCardEdit(edit: { cardId: number; songTitle: string; themeSlot: string; artistName: string }): void {
  commit(applyPartyCommand(state, { type: "cardEdited", ...edit }));
}

export function findPartyItemByToken(token: string): PartyQueueItem | null {
  return state.queue.find((item) => item.token === token) ?? null;
}

// Only the current item's reports count; a late one from the previous clip
// is dropped. No version bump: the display view is unchanged, so its stream
// stays quiet while the host's stream carries the new position.
export function reportPartyPosition(position: PartyPosition): boolean {
  if (currentPartyItem(state)?.token !== position.token) return false;
  commit({ ...state, position });
  if (position.failed) commit(withClipStatus(state, position.token, "failed"));
  else if (position.playing && position.elapsed > 0 && state.clipStatus[position.token] === "failed") {
    commit(withClipStatus(state, position.token, null));
  }
  if (shouldRevealEarly(state)) commit(applyPartyCommand(state, { type: "reveal" }));
  driveLightning();
  driveAutoAdvance(position);
  return true;
}

// A lightning round advances itself from the display's play time, which only
// arrives with these reports, so this is where it steps.
function driveLightning(): void {
  const step = lightningStep(state);
  if (step === "reveal") commit(applyPartyCommand(state, { type: "reveal" }));
  else if (step === "next") commit(applyPartyCommand(applyPartyCommand(state, { type: "next" }), { type: "play" }));
  else if (step === "stop") commit(applyPartyCommand(applyPartyCommand(state, { type: "pause" }), { type: "summary", visible: true }));
}

// How long the answer stays up when a song ends unrevealed, and the pause
// before moving on from one that was already revealed.
const END_REVEAL_HOLD_MS = 6000;
const END_REVEALED_HOLD_MS = 1500;
let endedToken: string | null = null;

// A song that plays to its end moves the game on by itself: reveal it first if
// the host has not, then go to the next song and keep playing. Lightning rounds
// run their own clock, and a player answering a buzz is the host's to judge.
function driveAutoAdvance(position: PartyPosition): void {
  if (!position.ended && endedToken === position.token) endedToken = null;
  if (!position.ended || !state.autoAdvance || state.lightning || state.buzz.playerId !== null) return;
  if (endedToken === position.token) return;
  endedToken = position.token;
  const wasRevealed = state.phase === "revealed";
  if (!wasRevealed) commit(applyPartyCommand(state, { type: "reveal" }));
  setTimeout(
    () => {
      if (currentPartyItem(state)?.token !== position.token || !state.autoAdvance) return;
      commit(applyPartyCommand(applyPartyCommand(state, { type: "next" }), { type: "play" }));
    },
    wasRevealed ? END_REVEALED_HOLD_MS : END_REVEAL_HOLD_MS,
  );
}
