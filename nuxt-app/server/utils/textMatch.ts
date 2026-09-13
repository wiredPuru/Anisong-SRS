// Shared by the cross-provider theme merge and by search ranking, so both agree
// on when two song titles are "the same". Only has to survive punctuation, case,
// spacing and accents ("Deja Vu" against "Déjà Vu"); a real spelling difference
// ("Kagami Hyoushi" against "Kagamiutsushi") deliberately fails to match.
export function titleKey(title: string | null): string | null {
  const key = (title ?? "").normalize("NFD").replace(/\p{Mark}/gu, "").toLowerCase().replace(/[^\p{Letter}\p{Number}]/gu, "");
  return key || null;
}
