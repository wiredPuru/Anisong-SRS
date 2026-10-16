import type { PartyAnswer, PartyHints, PartyJoinInfo, PartyRoundPoint, PartyScoreRow, PartySummary } from "~/composables/usePartyDisplay";

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
  facts: {
    year: 2020,
    season: "SPRING",
    format: "TV",
    studios: ["Sample Studio"],
    averageScore: 82,
    tags: ["Music", "School Club", "Female Protagonist"],
  },
};
export const SAMPLE_PLAYERS: PartyScoreRow[] = [
  { id: -1, name: "Player one", score: 5 },
  { id: -2, name: "Player two", score: 3 },
  { id: -3, name: "Player three", score: 1 },
];
export const SAMPLE_CHOICES = ["Sample Anime Title", "Another Show", "A Third Show", "The Fourth Show"];
export const SAMPLE_STAKE = { multiplier: 3, risk: true, player: "Player one" };
export const SAMPLE_BUZZER = "Player one";
export const SAMPLE_BANNER = "Next round!";
export const SAMPLE_SUMMARY: PartySummary = {
  standings: [
    { rank: 1, name: "Player one", score: 5 },
    { rank: 2, name: "Player two", score: 3 },
  ],
  songs: [
    { number: 1, anime: "Sample Anime Title", song: "Sample Song", scorers: ["Player one"] },
    { number: 2, anime: "Another Show", song: "Another Song", scorers: [] },
  ],
  played: 2,
  total: 10,
};
export const SAMPLE_ROUND: PartyRoundPoint[] = [
  { id: -1, name: "Player one", points: 2 },
  { id: -2, name: "Player two", points: 1 },
];
export const SAMPLE_JOIN: PartyJoinInfo = { code: "ABCD", urls: [] };
export const SAMPLE_HINTS: NonNullable<PartyHints> = {
  kind: "clues",
  items: [
    { label: "Aired", value: "Spring 2020" },
    { label: "Format", value: "TV" },
  ],
};
export const SAMPLE_RULES = "Buzz in before you answer.\nA wrong answer locks you out for the song.\nFirst to 10 points wins.";
