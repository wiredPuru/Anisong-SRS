# Current Feature

**Type:** Feature
**Build plan:** 105b. Open it from Study and Listen
**Branch:** feature/artist-link-new-tab
**Status:** verified

## Goal

The artist in `StudyInfoPanel` becomes a link that opens that artist's `/decks`
page (feature 105a's catalog section) in a new tab, on `/study` and `/listen`.
Preview and the `/cards` inspector keep their same-tab link.

## Decisions

- New optional `artistNewTab` prop on `StudyInfoPanel`; when set with
  `artistHref`, the link gets `target="_blank"` and `rel="noopener"`. Existing
  callers (Preview) are unchanged.
- Study and Listen pass `artistDeckPath(currentCard.artistId)`.
- Hide Info on Study: the panel is already `blurred` and `inert` until the
  answer is revealed, so the link cannot be clicked early. No extra gating.
- Opening in a new tab leaves the Study session untouched.

## Steps

- [x] 1. Add `artistNewTab` to `StudyInfoPanel`; pass href + flag from `/study` and `/listen`.

## Done when

- Clicking the artist on `/study` (once revealed) and `/listen` opens
  `/decks?type=artist&id=<id>` in a new tab; the current tab is unchanged.
- While info is hidden, the link cannot be clicked.
- Preview's artist link still opens in the same tab.
- Build passes; no UI-only logic added, so no new unit test.
