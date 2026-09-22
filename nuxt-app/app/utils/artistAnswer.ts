import { normalizeSongTitle } from "./songAnswer";

// Same normalization as song names: romanized artist names disagree on spacing
// ("Yui Hori" / "YuiHori") as much as song titles do.
export function evaluateArtistAnswer(card: { artistName: string }, typed: string): boolean {
  const answer = normalizeSongTitle(typed);
  return answer !== "" && answer === normalizeSongTitle(card.artistName);
}
