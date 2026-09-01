# Current Feature

## Title

Add error handling to `removeFolder` and `removeCard`

## Type

Fix

## Status

Verified

## Fixes

F-05

## The problem

Two delete actions are a bare `await $fetch(...)` with no `try`/`catch` and no
error display, unlike every other mutation in the app:

- `removeFolder(path)` - `nuxt-app/app/pages/settings.vue:34-37`
- `removeCard(id)` - `nuxt-app/app/pages/cards/index.vue:250-253`

Every sibling mutation already wraps its `$fetch` call and surfaces a
`*Error` ref on failure: `addFolder`/`setDefaultDownloadFolder`/`importDeck`
in `settings.vue`, `saveEdit`/`clearLocalPath`/`toggleDeckMembership` in
`cards/index.vue`, and `downloadMedia` (via `useCardDownloads()`, used by
both pages). If either `DELETE` call fails - a network hiccup, or the row
already being gone - the user gets an unhandled promise rejection and no
feedback, with no way to know the remove didn't happen.

## The fix

Wrap both functions in the same `try { ... } catch (err) { ...Error = 
extractErrorMessage(err, "..."); }` shape every sibling mutation already
uses, importing nothing extra - `extractErrorMessage` is already
auto-imported from `useApiError.ts` (F-04) in both files.

**`settings.vue` - `removeFolder`:** add a `removeFolderError = ref<string |
null>(null)`, matching how `addError`/`defaultFolderError` are already
single shared refs on this same page (only one folder action is realistically
in flight at a time here, same assumption those two already make). Clear it
at the start of the call, catch and set it to
`extractErrorMessage(err, "Failed to remove folder.")` on failure. Display it
with the existing `.add-error` class in the same spot `addError`/
`defaultFolderError` already render (below the folder list) - do not touch
`.folder-row`'s current flex layout.

**`cards/index.vue` - `removeCard`:** add a `removeCardError =
reactive<Record<number, string | null>>({})`, matching the per-card keying
`downloadError` already uses in this same file (via `useCardDownloads()`) for
the same reason - multiple rows can independently trigger a delete. Clear
`removeCardError[id]` at the start, catch and set it to
`extractErrorMessage(err, "Failed to delete card.")` on failure. Display it
under the card's `.card-actions` button row, reusing `.edit-error`'s text/color
styling; since `.card-row` and `.card-actions` are both `display: flex` with no
existing error slot in this (non-edit) view, add `flex-wrap: wrap` to
`.card-row` and a `flex-basis: 100%` rule on the new error paragraph so it
drops to its own full-width line only when present, without changing today's
no-error layout at all.

Must not break:

- The successful-remove path for both - a folder still disappears from the
  list, a card still disappears from `cards.value`, exactly as today.
- `.folder-row`'s and `.card-row`'s current layout when there's no error -
  the error elements are purely additive (`v-if`-gated) and must not shift
  or wrap anything when absent.
- Every other mutation on both pages - untouched.

## Build steps

- [x] **Step 1 - `removeFolder` error handling** - add `removeFolderError`,
  wrap the `$fetch` call in `try`/`catch`/no `finally` needed (no loading
  flag today, and none is required by the finding), render the error via
  the existing `.add-error` paragraph pattern. *Done when:* removing a
  folder still works normally; a forced failure (e.g. stop the dev server
  mid-click, or temporarily point the request at a bad path) shows an
  inline error instead of an unhandled rejection in the console, and the
  folder list layout is unchanged when no error is present.
- [x] **Step 2 - `removeCard` error handling** - add `removeCardError`,
  wrap the `$fetch` call in `try`/`catch`, render the per-card error under
  `.card-actions`, add the minimal `flex-wrap`/`flex-basis` CSS needed so it
  drops to its own line only when present. *Done when:* deleting a card
  still works normally; a forced failure shows an inline per-row error
  instead of an unhandled rejection, other rows are unaffected, and the
  card row layout is unchanged when no error is present.

## Verify

- Run `bun run build` (typecheck + build) - must pass clean.
- Manually remove a folder and delete a card successfully in the running
  app - both must still work exactly as before.
- Force a failure on each (e.g. temporarily rename/break the target API
  route, or disconnect the dev server briefly) and confirm an inline error
  message appears instead of a silent console rejection, then confirm a
  retry after fixing the cause still succeeds.
- Confirm neither row's layout changes when no error is present (visual
  check, before/after screenshot if convenient).

## Findings

None raised against this fix.
