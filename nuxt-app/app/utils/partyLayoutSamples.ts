import type { PartyAnswer, PartyHints, PartyJoinInfo, PartyPlayer, PartyRoundPoint } from "~/composables/usePartyDisplay";

// Stand-ins shown only while arranging the display (feature 91b), so a piece
// with nothing to show yet can still be placed.
export const SAMPLE_ANSWER: PartyAnswer = {
  animeTitleEnglish: "Sample Anime Title",
  animeTitleRomaji: "Sample Anime Title",
  animeTitleNative: "サンプル",
  songTitle: "Sample Song",
  artistName: "Sample Artist",
  themeSlot: "OP1",
  coverImageUrl: null,
};
export const SAMPLE_PLAYERS: PartyPlayer[] = [
  { id: -1, name: "Player one", score: 5, phone: false, connected: false },
  { id: -2, name: "Player two", score: 3, phone: false, connected: false },
  { id: -3, name: "Player three", score: 1, phone: false, connected: false },
];
export const SAMPLE_ROUND: PartyRoundPoint[] = [
  { id: -1, name: "Player one", points: 2 },
  { id: -2, name: "Player two", points: 1 },
];
export const SAMPLE_TIMER_SECONDS = 15;
export const SAMPLE_COUNT = { number: 3, total: 20 };
export const SAMPLE_JOIN: PartyJoinInfo = { code: "ABCD", urls: [] };
export const SAMPLE_HINTS: NonNullable<PartyHints> = {
  kind: "clues",
  items: [
    { label: "Aired", value: "Spring 2020" },
    { label: "Format", value: "TV" },
  ],
};
