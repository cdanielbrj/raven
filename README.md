# Raven

Raven is a self-hosted observation hub for upcoming entertainment events. The
v0.1 foundation is a single Docker container with a React web interface, Fastify
application API and SQLite database in `/data/raven.db`.

## Run with Docker

```sh
docker compose up --build -d
```

Open `http://localhost:8080`. The health endpoint is available at
`http://localhost:8080/health`.

The named `raven-data` volume persists the SQLite database. For a host-mounted
volume, replace it in `compose.yaml` with a directory mapped to `/data`.

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
every push and pull request.

## Foundation boundaries

- `src/models`: provider-independent media models and contracts.
- `src/application`: tracking use cases and synchronization orchestration.
- `src/infrastructure`: configuration and SQLite migrations.
- `src/api/internal`: Raven's HTTP API for its browser client.
- `src/api/external`: third-party integrations, starting with AniList.
- `src/web`: the bundled browser interface.

The initial AniList adapter is registered through `ProviderRegistry`; the API
and tracking core use the media format and provider contract rather than an
AniList-specific dependency. A future provider (for example, sports) is added
by implementing `Provider` and registering it in `src/server.ts`.

Tracking synchronization is currently explicit through
`POST /api/v1/tracking/anime/refresh`. The sync coordinator stores provider
state, avoids duplicate concurrent refreshes for a format and is the intended
home for provider-specific scheduled refreshes in a later release.
