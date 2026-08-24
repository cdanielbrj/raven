# Raven

Raven is a self-hosted observation hub for upcoming entertainment events. Its
first media type is anime, with a React web interface, Fastify application API
and a local SQLite database at `/data/raven.db`.

The current v0.1 implementation includes:

- Anime `Upcoming`, `Discovery` and `Tracking` views, plus local `Settings`.
- AniList as the primary catalog and schedule provider.
- Optional MyAnimeList catalog fallback and local Discovery snapshots for
  provider outages.
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
- `/settings`

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
- `src/application`: tracking, discovery and settings use cases.
- `src/application/discovery`: catalog fallback and local Discovery snapshots.
- `src/infrastructure`: configuration and SQLite migrations.
- `src/api/internal`: Raven's HTTP API for its browser client.
- `src/api/external`: third-party integrations, currently AniList and
  MyAnimeList.
- `src/web`: the bundled React interface, routes, layout and views.

The initial AniList adapter is registered through `ProviderRegistry`; the API
and tracking core use the media format and provider contract rather than an
AniList-specific dependency. A future provider (for example, sports) is added
by implementing `Provider` and registering it in `src/server.ts`.

Tracking synchronization is currently explicit through
`POST /api/v1/tracking/anime/refresh`. The sync coordinator stores provider
state, avoids duplicate concurrent refreshes for a format and is the intended
home for provider-specific scheduled refreshes in a later release.
