# Coding Standards

> Your conventions. Edit these once to match your stack. Tuned for `nuxt-app/`,
> a single local-only Nuxt app (an Anki/Migaku-style SRS flashcard app for
> anime song trivia) - see `blueprint/project-plan.md` for the full picture.
> Change or trim anything that doesn't fit as the project grows.
>
> Run `/onboard` after installing the Blueprint. It tunes this file to the real
> project stack, along with `AGENTS.md`, `CLAUDE.md` when present,
> `ai-interaction.md`, `.gitignore`, and README placement. Review the result
> before `/overview`.

## Project shape

`nuxt-app/` is the only package. It is a localhost-only, single-user app - no
accounts, no remote hosting, no multi-device sync (see Non-Goals in
`project-plan.md`).

## TypeScript

- Strict mode enabled
- No `any` types - use proper typing or `unknown`
- Define interfaces for DB models (Drizzle), API responses (AniList,
  animethemes.moe), and component props
- Use type inference where obvious, explicit types where helpful

## Vue / Nuxt

- Functional, `<script setup lang="ts">` components only (no class/Options API)
- Use composables (`useX`) for reusable stateful logic, not mixins
- Keep components focused - one job per component
- Server routes (`server/api/`) for anything touching SQLite, the local
  filesystem, or an external GraphQL API; components stay presentation-focused
  and call those routes rather than reaching into the DB or `fs` directly

## File Organization

- Pages: `nuxt-app/app/pages/[route]/index.vue`
- Components: `nuxt-app/app/components/[feature]/ComponentName.vue`
- Composables: `nuxt-app/app/composables/use[Feature].ts`
- Server routes: `nuxt-app/server/api/[feature]/[action].ts`
- DB schema (Drizzle): `nuxt-app/server/db/schema.ts`
- External API clients (AniList, animethemes.moe): `nuxt-app/server/lib/[client].ts`
- Types: `nuxt-app/app/types/[feature].ts`

## Naming

- Components: PascalCase (`FlashcardReview.vue`)
- Composables: camelCase, `use` prefix (`useStudySession.ts`)
- Files: match export name or kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Styling

Plain CSS custom properties, no framework (no Tailwind/UnoCSS/UI kit). The
design tokens (colors, fonts, radii, shadows) live in
`nuxt-app/app/assets/css/main.css` as `:root` custom properties, ported from
`prototypes/theme.css` - keep the two in sync if the look changes. Components
use scoped `<style>` blocks that reference `var(--token)`, never hard-coded
colors/sizes.

- No inline styles
- Japanese text must render as real, selectable DOM text (not an image or
  baked into video) so the Migaku browser extension can attach to it

## Data & State

- SQLite via Drizzle ORM + better-sqlite3; all schema changes go through
  Drizzle migrations, never manual `ALTER TABLE`
- AniList and animethemes.moe are both GraphQL APIs
  (https://api-docs.animethemes.moe for the latter) - call them only from
  server routes, cache the metadata that matters (titles, artist, theme
  references) into SQLite rather than re-fetching on every render
- Media files are referenced by path/URL, never copied into the DB; local
  paths come from the user-configured media library folder(s), remote
  references point at animethemes.moe
- No auth - this is a single-user local app. Do not add login/session
  scaffolding unless the plan changes

## Error Handling

- Use try/catch around anything that can fail at runtime: GraphQL calls,
  filesystem access to the media library, Drizzle queries
- A missing local media file or a failed API lookup should degrade the
  specific card/feature, not crash the app
- Display user-friendly error messages in the UI, not raw stack traces

## Testing

No test runner is configured yet, so the logic-test gate below is opt-in until
`/tests` (or `$tests`) adds one. Good early candidates once it exists: Leitner
box interval logic, GraphQL response mapping, and deck export/import
metadata handling - all pure logic with clear right/wrong answers.

When `AGENTS.md` declares a `Verify` command, treat it as the umbrella automated
gate. It combines only the checks this project actually has, in this order when
available: typecheck, tests, then build. The command does not enable an absent
test runner or replace focused evidence. It gives local work and optional CI one
exact command to run. `/ci` owns Verify and CI setup. `/tests` adds the real test
command to Verify when it already exists, but never creates CI only because
testing was configured.

**The opt-in switch is one signal: a `test` command in the Commands section of
`AGENTS.md`.** Declare one and **tests become a gate for logic-bearing steps**,
not an optional extra; leave it out and the loop verifies logic with the evidence
it already uses (run it, a screenshot, the build). Adding the runner is itself a
deliberate step, never a silent mid-step install. This is the single definition
of the switch; the skills and `ai-interaction.md` only point back here.

- **What to test (the scope rule):** pure logic where a wrong answer is possible -
  parsers, formatters, validators, id/slug builders, server actions. These have
  assertable inputs and outputs and real edge cases (empty, missing, malformed).
- **What not to test:** UI components and integration-level surfaces (render or
  export routes, anything driving a real browser or external service). Verify those
  with a screenshot and the build, not brittle unit tests.
- **The gate (when a runner is configured):** a build step that adds in-scope logic
  must ship a passing test in the same reviewable diff. The project's test command
  must be green before the step is approved, before any checkpoint commit, and
  before `/complete` merges. UI and integration-only steps are exempt and ride on
  screenshot plus build evidence.
- **When it's named:** the `/feature` spec's Testing section predicts the coverage,
  `/implement` writes the test with the step, and if a step surfaces logic the spec
  didn't foresee, add a focused test then.
- An empty suite should fail, not pass, so "no tests ran" never looks like "passed".
- Test files live next to source files (for example `feature.test.ts`).
- Run them via the project's test command (see Commands in `AGENTS.md`), not a
  hardcoded tool name.

Stack binding: Vitest, with `vi.mock()` for external dependencies (AniList,
animethemes.moe, the filesystem) and `vi.useFakeTimers()` for Leitner-box
interval/scheduling logic.

## Browser Verification

For UI and integration behavior, prefer real browser evidence over reading the
code and assuming it works.

- If Playwright is already installed, or the Commands section of `AGENTS.md`
  declares a Playwright script, use Playwright for browser checks, screenshots,
  console-error checks, and user-flow verification.
- If Playwright is not installed, do not add it silently in the middle of an
  unrelated feature. Use the available dev server, browser screenshots, build
  output, API output, or manual verification evidence instead.
- Add Playwright only when the user asks for it, or when the current spec is
  explicitly about setting up browser automation.
- Browser evidence is especially important for flows that click, type, submit,
  navigate, download files, render complex layouts, or depend on client-side
  state.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- No banner/header blocks, section dividers, or step-by-step narration of obvious
  code. A file does not need a comment announcing each region.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
