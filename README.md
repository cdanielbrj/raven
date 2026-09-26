# Raven

Raven is a self-hosted observation hub for upcoming entertainment events. Its
first media type is anime, with a React web interface, Fastify application API
and a local SQLite database at `/data/raven.db`.

The v0.2 release extends Raven's v0.1 Anime foundation with its first Sports
pilot:

- Anime `Upcoming`, `Discovery` and `Tracking`, NBA `Upcoming`, `Teams` and
  `Tracking`, plus local `Settings`.
- AniList as the primary catalog and schedule provider.
- Optional MyAnimeList catalog fallback and local Discovery snapshots for
  provider outages.
- BALLDONTLIE for the NBA team catalog and schedule, with games limited to
  followed teams.
- Optional TheSportsDB team artwork, independent from NBA schedule data.
- Local-only tracking data. Items found through a fallback provider can remain
  followed until their schedule is available from the primary provider.
- A responsive client-side interface with direct routes for every implemented
  view.

## Run with Docker

```sh
docker compose up --build -d
```

Open `http://localhost:8080`. It currently redirects to Anime Upcoming; this is
temporary until Raven has its own landing page. The health endpoint is available
at `http://localhost:8080/health`.

The named `raven-data` volume persists the SQLite database. For a host-mounted
volume, replace `raven-data:/data` in `compose.yaml` with a directory mapped to
`/data`.

## Routes

- `/anime/upcoming`
- `/anime/discovery`
- `/anime/tracking`
- `/sports/nba/upcoming`
- `/sports/nba/teams`
- `/sports/nba/tracking`
- `/settings`

NBA Upcoming shows only the remaining games this week involving followed
teams. Opening the view refreshes the current season schedule from BALLDONTLIE
using those team IDs; weeks without scheduled games show an empty state.

The server returns the web application for these client-side routes, so direct
access and browser refresh work in a Docker deployment.

## Optional MyAnimeList fallback

Raven uses AniList as its primary anime catalog provider. A self-hosted
installation can optionally configure MyAnimeList as a Discovery fallback. No
Raven user account or MyAnimeList user authorization is required.

```sh
cp .env.example .env
```

Set `MAL_CLIENT_ID` in `.env`. The container starts normally without it. When
AniList is unavailable, Raven tries MyAnimeList; if neither provider can serve
the request, Raven returns the most recent matching Discovery snapshot from
SQLite and marks it as outdated.

Provider connection status and individual manual checks are available in
`Settings`.

## Optional NBA provider

Set `BALLDONTLIE_API_KEY` in `.env` to enable NBA team discovery and schedule
synchronization. The container still starts without this key; Anime remains
available, while the NBA provider is reported as not configured. The schedule
refresh runs when NBA Upcoming is opened and requests games for followed team
IDs only.

## Development

Node.js 22 or newer is required.

```sh
npm install
npm run dev
```

Useful commands:

```sh
npm run format:check
npm test
npm run build
```

GitHub Actions runs the same checks and verifies the production Docker image on
every push and pull request. The test suite covers provider normalization,
local persistence, fallback behavior, tracking and HTTP route contracts.

## Foundation boundaries

- `src/models`: provider-independent media models and contracts.
- `src/application/core`: cross-format Discovery, Settings and Tracking
  capabilities.
- `src/application/sports/nba`: NBA schedule and team-identity use cases.
- `src/infrastructure`: configuration and SQLite migrations.
- `src/api/internal`: Raven's HTTP API for its browser client.
- `src/api/external`: third-party integrations, currently AniList,
  MyAnimeList, BALLDONTLIE NBA and TheSportsDB team assets.
- `src/web`: the bundled React interface, with domain views under `views/` and
  presentation components grouped under `themes/raven`, `themes/anime` and
  `themes/sports`.

The AniList adapter is registered through `ProviderRegistry`; the API and
tracking core use the media format and provider contract rather than an
AniList-specific dependency. The NBA schedule is league-scoped because one game
has two team participants; its schedule service persists only games involving
followed teams.

Anime tracking synchronization is explicit through
`POST /api/v1/tracking/anime/refresh`. NBA schedule synchronization is exposed
through `POST /api/v1/sports/nba/refresh` and runs when NBA Upcoming is opened.
