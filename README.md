<p align="center">
  <img src="nuxt-app/public/mascot/temi-640.webp" width="220" height="220" alt="Temi, the GAQ SRS mascot, wearing headphones at a quiz buzzer">
</p>

# GAQ SRS

**Learn anime openings and endings, one song at a time.**

GAQ SRS is a local flashcard app for practicing
[Anime Music Quiz](https://animemusicquiz.com). Listen to a clip, try to name
the anime, song, and artist, then mark your answer. Spaced repetition brings
back the songs you miss and gives the ones you know more time between reviews.

A warm, pastel interface and **Temi**, your headphone-wearing quiz companion,
make room for the important part: listening.

[Download a release](https://github.com/wiredPuru/Anisong-SRS/releases) ·
[Get started](#getting-started) · [Run from source](#building-from-source)

<p align="center">
  <img src="docs/screenshots/home.png" width="1000" alt="Home dashboard with Temi, due cards, recent review activity, and weakest decks">
</p>

## What you can do

- **Build your song library.** Search by anime, song, or artist and choose the themes you want to learn.
- **Practice your way.** Hide the video, cover art, or answer; use random start times and timed reveals.
- **Study a focused deck.** Browse automatic anime and artist decks, or create your own and add cards in bulk.
- **Read along.** Show English, romaji, and Japanese titles, with optional furigana.
- **Track progress.** See due cards, your activity streak, and pass rates by anime or artist.
- **Keep your library local.** Stream and cache clips, download them, or use files you already have.

Your cards, settings, and review history stay on your computer. No account or
cloud sync is required. Online searches and remote playback use external
services: AniList for anime metadata, AnisongDB and AMQ media hosts for song
data and clips, and animethemes.moe as a fallback.

## Install

Download your platform from the
[Releases page](https://github.com/wiredPuru/Anisong-SRS/releases), unzip the
archive, and run the executable. It starts a local server and opens the app
in your browser. You do not need to install Node, Bun, or Nuxt.

| Platform | Archive |
| --- | --- |
| Windows (x64) | `gaq-srs-windows-x64.zip` |
| macOS (Apple Silicon) | `gaq-srs-macos-arm64.zip` |
| macOS (Intel) | `gaq-srs-macos-x64.zip` |
| Linux (x64) | `gaq-srs-linux-x64.zip` |

Keep the executable together with its `migrations/`, `public/`, and
`kuromoji/` folders.

### First launch

The releases are not signed with a trusted publisher certificate, so your OS
may show a warning. For an archive you downloaded from this repository:

- **macOS:** right-click the executable and choose **Open**. If macOS still blocks it, clear the extracted folder's quarantine flag with `xattr -dr com.apple.quarantine /path/to/folder`.
- **Windows:** if SmartScreen appears, choose **More info**, then **Run anyway**.
- **macOS / Linux:** if needed, make the executable runnable with `chmod +x gaq-srs`.

Your database is stored in your OS's app-data directory, outside the extracted
app folder. To upgrade, close the app and replace the release folder, keeping
any media you stored there. Packaged builds check for newer releases and link
you to the download; updates are installed manually.

## Getting started

### 1. Find songs and add cards

Open **Cards** and search for an anime, song, or artist. The search shows
matches from your existing library alongside songs you can add. Pick an anime
to browse its openings and endings, or search an artist to explore themes
across shows.

Preview cards, edit their details, and select multiple cards to add to one of
your created decks.

<p align="center">
  <img src="docs/screenshots/cards.png" width="1000" alt="Cards library in the current rose and charcoal theme, with search, song rows, and card controls">
</p>

### 2. Listen, guess, and review

Choose **Start session** on Home or open **Study**. Listen to the clip, guess
the answer, then use **Pass** or **Fail**. Hide the video, cover, and info panel
to control which clues you get. **Auto reveal** can uncover the video, info,
or both on a timer.

<p align="center">
  <img src="docs/screenshots/study.png" width="1000" alt="Study screen with the media player, anime and song information, and review controls">
</p>

A pass advances the card one box, up to box 5. A fail returns it to box 1,
where it can appear again in the same session.

| Box | Next review |
| --- | --- |
| 1 | Immediately |
| 2 | 1 day |
| 3 | 3 days |
| 4 | 7 days |
| 5 | 14 days |

Use **Previous** to look at the last reviewed card, or open the session log
to revisit earlier answers. Settings also lets you pace the introduction of
new cards.

<details>
<summary>Study keyboard shortcuts</summary>

| Key | Action |
| --- | --- |
| <kbd>←</kbd> / <kbd>→</kbd> | Fail / Pass |
| <kbd>S</kbd> | Play / pause |
| <kbd>I</kbd> | Hide / show info |
| <kbd>V</kbd> | Hide / show video |
| <kbd>C</kbd> | Hide / show cover art |
| <kbd>A</kbd> | Toggle ambient glow |
| <kbd>P</kbd> | Preview the previous card |
| <kbd>L</kbd> | Open / close the session log |

</details>

### 3. Pick a deck

**Decks** automatically groups your cards by anime title and artist. Choose a
deck to practice that part of your library, or use **Created** decks to make
your own mix.

<p align="center">
  <img src="docs/screenshots/decks.png" width="1000" alt="Deck browser with anime cover artwork, deck counts, and title, artist, and created-deck tabs">
</p>

Anime and artist decks can be exported to a folder and imported through
**Settings**, including for sharing with another person.

### 4. Tune playback and follow your progress

**Settings** holds your local media folders, download preferences, streaming
cache limit, and **Audio only** playback option. Remote clips are cached as
you play them; downloading clips or linking local files lets you keep media
available for offline practice.

**Stats** shows your overall pass rate and results by anime or artist. Home
brings together recent activity, due cards, recently added songs, and your
weakest decks to help you choose what to practice next.

## Building from source

With Bun installed, run from the repository root:

```bash
cd nuxt-app
bun install
bun run dev
```

Open `http://localhost:3000`.

| Command (inside `nuxt-app/`) | Purpose |
| --- | --- |
| `bun run test` | Run unit tests |
| `bun run build` | Build the production app |
| `bun run preview` | Run the production build locally |
| `bun run launch` | Launch the built app and open a browser |
| `bun run package` | Package release executables and archives |

Built with **Nuxt, Vue, TypeScript, SQLite, Drizzle, and Bun**. Packaging
requires a production build first; macOS targets also require macOS for
ad-hoc signing. See [AGENTS.md](AGENTS.md) for full commands and the project's
Blueprint development workflow.
