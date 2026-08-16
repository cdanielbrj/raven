# Raven Architecture

> Raven is the core application of the **Ravencue** observation hub.
>
> Raven observes external entertainment sources, normalizes relevant information, lets the user decide what deserves attention, and presents upcoming events in a concise chronological hub.

**Status:** Architecture draft for v0.1
**Primary deployment:** Docker
**Persistence:** SQLite
**Primary interface:** Responsive Web UI
**Initial domain:** Anime
**Planned next domain:** Sports

---

## 1. Product definition

Raven is **not** a calendar, media diary, social network, recommendation platform, or historical tracker.

Its purpose is narrower:

1. discover entertainment entities from external providers;
2. let the user explicitly choose what they want Raven to track;
3. collect upcoming events for tracked entities;
4. normalize those events into a provider-independent model;
5. present them chronologically in a lightweight web hub;
6. eventually expose the same upcoming events to external outputs such as ICS / Apple Calendar.

The central product flow is:

```text
External providers
       ↓
   Discovery
       ↓
  User selects
       ↓
   Tracking
       ↓
 Upcoming Events
       ↓
    Upcoming
```

The core product is the **code, domain model, provider contract and experience**.

External catalog data is not the product and should not become permanent local data unless it is relevant to the local Raven instance.

---

## 2. Naming and lore

### Raven

**Raven** is the application/core.

It is the software that runs in Docker, owns the SQLite database, talks to providers, normalizes data, stores tracking choices and presents events.

Technical naming should prefer `raven`:

```text
repository: raven
container: raven
database: raven.db
appdata: /data
```

### Ravencue

**Ravencue** is the broader observation-hub identity.

Raven may eventually be released or presented as part of Ravencue rather than as an isolated product identity.

The lore is intentionally subtle:

> Raven observes. Ravencue gathers.

The lore must never reduce code readability. Internally, technical concepts should keep conventional names such as `Provider`, `Event`, `Entity`, and `Tracking`.

---

## 3. Core product principles

### 3.1 Discovery and Tracking are different concerns

**Discovery** represents things Raven knows exist through providers.

**Tracking** represents things the local user explicitly wants Raven to watch.

Discovery data must not automatically pollute the Upcoming timeline.

```text
Known by provider ≠ relevant to user
Tracked by user   = relevant to user
```

### 3.2 Events are structured and ephemeral

An event exists because something relevant is going to happen.

Examples:

- an anime episode airs;
- a Formula 1 race starts;
- a football match is scheduled;
- a future series episode releases.

Raven does **not** need to maintain permanent history of completed events.

Once an event is:

- explicitly marked as watched / participated;
- no longer relevant;
- or past the configured retention horizon;

it may be deleted from the local database.

Historical consumption tracking is intentionally outside the v0.1 product model.

### 3.3 Tracking represents interest, not history

Tracking means:

> Raven should continue watching this entity for me.

It does not mean:

> Raven should permanently remember everything I consumed from this entity.

Example:

```text
Track Frieren
    ↓
Raven watches future Frieren events
    ↓
Episode 8 happens
    ↓
Event can be deleted
    ↓
Frieren remains tracked
```

### 3.4 Providers are replaceable

Raven must never become semantically coupled to AniList, a sports API, TMDB, or any other provider.

Providers translate external systems into Raven's own domain vocabulary.

```text
External API
    ↓
 Provider
    ↓
normalize
    ↓
Raven domain
```

Removing or replacing a provider must not require redesigning Raven's core concepts.

### 3.5 No external user account should be required for basic usage

Raven should prefer public/anonymous catalog access.

Provider authentication modes are conceptually:

```text
NONE      preferred
INSTANCE  acceptable
USER      optional / last resort
```

- `NONE`: Raven queries public data directly.
- `INSTANCE`: the self-hosted Raven instance uses one API key/token.
- `USER`: the user connects their personal provider account.

`USER` authentication must not be required for basic Raven functionality in official providers when avoidable.

Connecting a user account may be added later only as a convenience feature, for example importing an existing AniList watchlist.

### 3.6 Users should not author external catalog data

Raven should ask external providers what exists.

The user should primarily decide what matters.

The normal flow must be:

```text
Search / browse
      ↓
Provider result
      ↓
Track
```

Not:

```text
Create anime manually
Enter title manually
Enter release schedule manually
Upload artwork manually
```

Manual entities/events may be introduced later as an escape hatch, but they must not shape the v0.1 architecture.

---

## 4. Scope

## 4.1 v0.1 goals

v0.1 validates the Raven core with the smallest useful domain.

### Required

- single Docker container;
- SQLite persistence;
- responsive web interface;
- chronological Upcoming timeline;
- Discovery view;
- Tracking view;
- provider abstraction;
- one working Anime provider;
- search/browse anime from external provider;
- track/untrack an anime;
- retrieve upcoming anime events;
- persist only locally relevant entities/tracking/events;
- delete completed/obsolete events safely;
- no mandatory external user account.

### Initial provider

AniList is the preferred first Anime provider because it can expose public catalog data and airing schedules without requiring the Raven user to maintain an AniList account for basic usage.

The provider implementation is replaceable and must remain behind the provider contract.

## 4.2 Planned next domain: Sports

Sports is the first major validation that Raven's domain model is provider-independent.

Sports introduces different event types and potentially entity-level preferences, for example:

```text
Formula 1
├── Race          ✓
├── Qualifying    ✓
├── Sprint        ✓
└── Practice      ✗
```

The sports provider itself does **not** need to be selected or implemented in v0.1.

Provider selection should prioritize:

- structured schedules;
- reliable future dates/times;
- good coverage;
- acceptable rate limits;
- `NONE` or `INSTANCE` authentication;
- minimal dependency on personal user accounts.

## 4.3 Explicit non-goals for v0.1

Do not implement these unless they become necessary to complete a required v0.1 flow:

- multi-user authentication;
- external user account synchronization;
- historical watched database;
- ratings;
- reviews;
- social features;
- comments;
- achievements;
- recommendation AI;
- statistics dashboard;
- manga tracking;
- books;
- game tracking;
- movies/series providers;
- notifications;
- push notifications;
- Apple Calendar integration;
- CalDAV server;
- full calendar UI;
- offline-first/PWA support;
- multiple database engines;
- Redis;
- message queues;
- separate worker container;
- separate frontend container;
- manually authored catalog entries.

---

## 5. Domain model

Raven should start with a deliberately small domain:

```text
Entity
Event
Tracking
Provider
Settings
```

Provider may initially exist only as code/configuration rather than as a database table.

---

## 6. Entity

An `Entity` is something the user may track.

Examples:

```text
Frieren
Formula 1
Flamengo
Severance
```

An entity is not an event.

`Frieren` is an entity.

`Episode 8 airing on Tuesday at 18:30` is an event.

### Suggested shape

```text
Entity
────────────────────────────
id
format
name
provider
external_id
cover_url?
icon_url?
external_url?
metadata?
created_at
updated_at
```

### Required principles

- `name` must be clean and represent the entity name only.
- Provider-specific identifiers must be stored separately.
- Raven should not copy entire external catalogs into SQLite.
- Entities should normally become persistent when the user starts tracking them.

---

## 7. Event

`Event` is the central temporal object in Raven.

An event represents one relevant occurrence associated with an entity.

### Core fields

Conceptually:

```text
Event
────────────────────────────
id
entity_id
name?
type
format
starts_at
ends_at?
all_day
provider
external_id?
external_url?
source?
metadata?
created_at
updated_at
```

### `name`

`name` is optional.

It exists only when the **event itself has a proper name**.

Correct:

```text
Entity: Formula 1
Event name: Spanish Grand Prix
Type: race
```

Also correct:

```text
Entity: Frieren
Event name: null
Type: episode
Episode: 8
```

Incorrect:

```text
Event name: "Frieren - Episode 8"
```

Structured data must never be concatenated into `name` merely to simplify rendering.

### `type`

`type` describes **what kind of event this is**.

Examples:

```text
episode
match
race
qualifying
sprint
release
```

### `format`

`format` describes **the broader entertainment domain**.

Examples:

```text
anime
sport
series
movie
game
```

`format` is intentionally broader than `type`.

### Date/time

Do not split an event into generic `date` and `time` columns. Model the precision
of the schedule explicitly instead:

```text
starts_at?       UTC timestamp when an exact time is known
starts_on?       ISO date when only a date is known
time_precision   datetime | date
```

`starts_at` and `starts_on` are mutually exclusive for v0.1. The UI renders an
exact local time only for `datetime`; for `date`, it renders the date alone and
must not imply that a time will be confirmed later.

The model must tolerate:

- timezone conversion;
- all-day events;
- events with unknown exact time;
- events with an optional end time;
- provider schedule updates.

Prefer normalized UTC persistence plus explicit timezone handling at the application boundary.

### Optional structured fields

Do not prematurely add every imaginable media-specific field to the main table.

Fields should graduate into the formal schema when they become common and useful across providers.

For v0.1 anime, an event may need an explicit field such as:

```text
episode_number?
```

Later sports may introduce fields such as:

```text
round?
competition?
opponent?
session?
```

Rule:

> Repeated cross-provider data may become formal domain fields. Exceptional provider-specific data remains in `metadata`.

---

## 8. Event names must remain clean

This is a hard domain rule.

Raven must not store presentation strings as domain values.

Bad:

```text
name = "Frieren - Episode 8"
name = "Flamengo vs Palmeiras - Brasileirão - Round 23"
```

Good:

```text
Entity.name = Frieren
Event.type = episode
Event.episode_number = 8
```

Good:

```text
Entity.name = Flamengo
Event.type = match
Event.opponent = Palmeiras
Event.competition = Brasileirão
Event.round = 23
```

Presentation is the UI's responsibility.

The UI may render:

```text
Frieren
Episode 8
```

or later:

```text
Frieren · EP 8
```

without changing stored domain data.

---

## 9. Cover and icon are different concepts

Do not create a generic `thumbnail` concept that conflates artwork and identity.

### Cover

A `cover` is editorial artwork.

Typical uses:

- Discovery;
- details;
- visual browsing.

Examples:

- anime key art/poster;
- series poster;
- movie poster;
- optional event banner.

### Icon

An `icon` is compact identity.

Typical uses:

- Home timeline;
- compact Tracking lists;
- sports teams;
- leagues;
- brands.

Examples:

- Formula 1 mark;
- football club crest;
- competition logo.

### Valid states

Every entity/event must render correctly in all cases:

```text
cover ✓  icon ✓
cover ✓  icon ✗
cover ✗  icon ✓
cover ✗  icon ✗
```

The absence of imagery must not look like broken content.

The Upcoming timeline should favor compact icons or no asset.

Discovery may use covers where available.

Never substitute an icon into a cover slot or treat a cover as an icon.

---

## 10. Tracking

Tracking is a persistent local decision that represents interest in an entity.

Suggested shape:

```text
Tracking
────────────────────────────
id
entity_id
enabled
preferences?
created_at
updated_at
```

For the initial single-user local application, `user_id` is not required.

Future multi-user support may introduce:

```text
User
Tracking.user_id
```

without changing the meaning of `Tracking` itself.

### Tracking preferences

Preferences are optional and domain-dependent.

Example future Sports preferences:

```json
{
  "race": true,
  "qualifying": true,
  "sprint": true,
  "practice": false
}
```

Do not over-design preference infrastructure in v0.1 if Anime does not require it.

An entity may remain tracked even when it has no upcoming events. This is an
expected state for completed anime, future releases without a published schedule,
and temporarily incomplete provider data. Tracking should render this state
clearly rather than treating it as an error.

---

## 11. Provider contract

A Provider knows an external system.

Raven core does not.

Conceptual interface:

```ts
interface Provider {
  id: string;
  format: string;

  capabilities: {
    discovery: boolean;
    events: boolean;
    availability: boolean;
    covers: boolean;
    icons: boolean;
  };

  authentication: {
    type: "none" | "instance" | "user";
  };

  syncPolicy: {
    defaultInterval: string;
    maxConcurrentSyncs: number;
  };

  discover(query: DiscoveryQuery): Promise<DiscoveryResult[]>;
  getEntity(externalId: string): Promise<NormalizedEntity>;
  getEvents(entity: NormalizedEntity): Promise<NormalizedEvent[]>;
}
```

Exact TypeScript names are not mandatory, but the architectural boundary is.

Provider limits are runtime behavior, not fixed assumptions. Raven must respect
provider response headers and retry instructions (for example `Retry-After`),
in addition to a conservative local rate limit. A manually requested sync uses
the same provider queue as periodic sync; it must never start competing syncs.

### Provider responsibilities

Providers may:

- call external APIs;
- map external fields;
- interpret provider IDs;
- normalize titles;
- normalize timestamps;
- map artwork into cover/icon fields;
- map provider-specific event data;
- expose source URLs;
- expose availability/watch information when provided.

Providers must not:

- render UI;
- decide what the user tracks;
- own Raven persistence semantics;
- write presentation strings into event names;
- couple Raven core to provider-specific data structures.

---

## 12. Discovery behavior

Discovery should query providers on demand and avoid permanently persisting large external catalogs.

Example:

```text
GET /discovery/anime?search=frieren
        ↓
AniListProvider
        ↓
normalized results
        ↓
UI
```

When the user selects `Track`:

```text
Provider result
      ↓
persist relevant Entity
      ↓
create Tracking
      ↓
fetch/sync upcoming Events
```

A small cache may be introduced if needed for API health/rate limits, but it must remain an implementation optimization, not a permanent mirror of provider datasets.

---

## 13. Event synchronization

Only tracked entities need continuous event synchronization.

Conceptual flow:

```text
scheduled sync
     ↓
load active Tracking
     ↓
resolve Entity provider
     ↓
Provider.getEvents(entity)
     ↓
normalize
     ↓
upsert upcoming Event rows
     ↓
remove/update stale Event rows
```

The sync mechanism should run inside the Raven application process for the single-container deployment.

Do not introduce a separate worker service for v0.1.

Each provider controls its own default interval. For AniList, v0.1 should start
with a configurable six-hour interval, one in-process sync at a time, and a
manual sync action that joins the same queue. Startup sync should run only when
the previous successful sync is older than the configured interval.

### Idempotency

Provider sync must be idempotent.

The same remote event returned repeatedly must update the existing local event rather than create duplicates.

Prefer provider + external event ID when available.

Fallback identity strategies may be provider-specific but must be deterministic.

### Schedule changes

External schedules change.

Raven should treat provider data as authoritative for future events and update local timestamps/details during synchronization.

Do not delete an event solely because it was absent from one provider response:
pagination and provider schedule horizons can create false absences. Persist
sync provenance such as `last_seen_at`, and only delete an event when it is
outside the fetched horizon, has passed the retention policy, is explicitly
cancelled, or is otherwise known to be obsolete.

---

## 14. Event lifecycle and cleanup

Events are disposable projections of upcoming provider data.

Possible lifecycle:

```text
provider discovers event
      ↓
local event inserted
      ↓
visible in Upcoming
      ↓
watched / participated / expired
      ↓
DELETE
```

A cleanup routine should safely remove events that no longer need to exist.

Potential cleanup inputs:

- explicit user action: watched / participated;
- event ended before a configured retention threshold;
- entity is no longer tracked;
- provider no longer reports the event and Raven determines it is obsolete/cancelled.

No separate archive/history table is required in v0.1.

Marking an event as watched removes it from the active timeline, but a provider
may still return it during a later sync. Raven should therefore keep a small,
expiring suppression record keyed by provider event identity (for example
`provider`, `external_event_id`, `expires_at`). It exists only to prevent
reappearance until the event has naturally left the provider schedule; it is
not consumption history. Untracking an entity deletes its events and associated
suppression records immediately.

---

## 15. Source and availability

Raven should distinguish between:

1. **data provider** — where Raven learned the data;
2. **consumption source / availability** — where the user can watch the event/content.

Do not overload one field to represent both concepts.

Example:

```text
provider = anilist
source = Crunchyroll
```

or, if richer availability becomes necessary:

```text
availability[]
├── provider: Crunchyroll
├── url?
├── region?
└── note?
```

For v0.1, implement only as much availability detail as the initial provider reliably exposes.

---

## 16. Persistence

SQLite is the default and intended database.

This is an architectural requirement, not a temporary development shortcut.

### Rationale

Raven is designed for self-hosted local instances with modest state:

- tracked entities;
- local preferences;
- upcoming events;
- settings.

It does not need an external database server.

### Database location

```text
/data/raven.db
```

`/data` must be the single primary persistent Docker volume.

### SQLite expectations

- enable WAL mode where appropriate;
- use application-level migrations;
- run migrations automatically at startup;
- keep schema changes backward-safe whenever practical;
- provide graceful shutdown;
- avoid unnecessary long transactions;
- do not introduce PostgreSQL/MySQL abstractions in v0.1.

### Backup model

The persistence model should remain easy to reason about:

```text
backup /data
```

The database is intentionally portable.

---

## 17. Future multi-user model

Raven v0.1 is single-user and does not require local account management.

This is intentional.

Future expansion can take two paths without invalidating the core:

### Independent local instances

```text
Instance A
└── raven.db

Instance B
└── raven.db
```

This remains the simplest self-hosted model.

### Local multi-user instance

If actual demand appears:

```text
User
Tracking.user_id
Preferences.user_id
```

SQLite does not need to be abandoned merely because multiple local users exist.

A different database should only be considered if real concurrency/distribution requirements justify it.

v0.1 is intended for a trusted home network. It does not provide its own
authentication boundary for public exposure; a reverse proxy and external
authentication solution are expected if the instance is exposed before Raven
gains that capability.

---

## 18. Docker deployment

Raven is Docker-first.

The official installation path should be a single container.

### Deployment philosophy

> One image. One container. One volume. One port.

Do not split Raven into frontend/backend/database/worker containers for v0.1.

Conceptual deployment:

```text
┌─────────────────────────────┐
│            Raven            │
│                             │
│  Web UI                     │
│  API                        │
│  Provider adapters          │
│  Internal scheduler         │
│  SQLite                     │
│                             │
│  /data/raven.db             │
└─────────────────────────────┘
            │
            ▼
      persistent volume
```

### Expected Docker characteristics

- single published application port;
- `/data` persistent volume;
- timezone configurable with environment variables;
- provider secrets/API keys configurable through environment variables or secrets;
- health-check endpoint;
- non-root runtime when practical;
- graceful shutdown;
- automatic migrations;
- restart-safe sync logic;
- image suitable for GHCR;
- `docker compose up -d` should be a normal installation path;
- future Unraid Community Apps template should be straightforward.

The default image must not assume public exposure. Network binding and any
reverse-proxy authentication remain deployment decisions until Raven adds an
application-level access-control model.

Example shape:

```yaml
services:
  raven:
    image: ghcr.io/<owner>/raven:latest
    container_name: raven
    ports:
      - "8080:8080"
    volumes:
      - /mnt/user/appdata/raven:/data
    environment:
      - TZ=America/Sao_Paulo
    restart: unless-stopped
```

This is illustrative, not a locked port/image name contract.

---

## 19. Suggested application architecture

Raven should remain a modular monolith.

A possible logical structure:

```text
src/
├── models/
│   ├── media/
│   └── provider/
├── application/
│   └── tracking/
├── api/
│   ├── internal/
│   └── external/
│       └── anilist/
├── web/
└── infrastructure/
    └── database/
```

Exact framework conventions may alter the physical layout.

The architectural requirement is separation of concerns, not a rigid folder tree.

### Future service extraction

Raven starts as an in-process modular monolith, but provider modules are
independently deployable candidates. The core domain and application services
must depend only on the provider contract, not on a concrete in-process module.

A provider may become a separate service later when its cadence, credentials,
availability requirements, release cycle, or workload justifies the operational
cost. Adding a provider alone is not sufficient reason to distribute the system.
The first extraction should preserve the same normalized provider contract and
must not move Raven domain ownership or Tracking persistence into the provider.

---

## 20. API / service boundaries

The UI should communicate with Raven's own application API/service layer.

The browser should not directly become responsible for provider semantics.

Preferred direction:

```text
Browser
  ↓
Raven API / application service
  ↓
Provider abstraction
  ↓
External API
```

This keeps:

- provider credentials server-side;
- normalization centralized;
- rate-limit behavior consistent;
- future provider replacement invisible to the UI.

---

## 21. Web product structure

Each media format has a focused product context:

```text
Anime
├── Upcoming
├── Discovery
└── Tracking

Sports
├── Upcoming
├── Discovery
└── Tracking
```

`Upcoming` replaces the ambiguous format-level `Home`. It shows the next seven
days for one format. `Discovery` and `Tracking` remain scoped to that same
format.

Raven will later add an explicit unified view:

```text
All Upcoming / Calendar
└── events from every tracked format
```

The unified view is a projection across formats; it does not replace the
format-specific views. This keeps each provider experience focused while making
mixed Anime, Sports and future events possible without a domain-model rewrite.

Settings may live under a compact application menu rather than becoming primary navigation.

---

## 22. Upcoming

Upcoming is the primary within-format Raven experience.

It should answer:

> What relevant things are happening soon?

It is not a traditional calendar grid and should not be called a dashboard internally unless required by implementation language. v0.1 uses a moving seven-day window from the current time.

Primary presentation uses a focused first event, followed by the remaining
events grouped as `This week` (through Sunday) and `Next week` (the rest of
the rolling seven-day window):

```text
TODAY

TODAY · SAT 15
18:30  ANIME
       Frieren
       Episode 8
       Crunchyroll

SUN 16
10:00  SPORTS
       Formula 1
       Spanish Grand Prix
       Race · F1 TV

21:00  ANIME
       One Piece
       Episode 1142
       Crunchyroll
```

When no event occurs today, the primary label becomes `NEXT UP · <actual date>`;
Raven must not call a future event `Today`.

### Upcoming asset rule

The focused first event may use provider media in this strict enhancement
order:

1. a provider trailer, autoplayed muted;
2. a provider banner image when no usable trailer exists;
3. a static cover-derived treatment when no banner exists.

The trailer is progressive enhancement only: respect `prefers-reduced-motion`,
never autoplay sound, and do not make the event unreadable or inaccessible
when an embed fails. Remaining events are compact temporal cards: a full-height
cover occupies the left edge, while format, title, genre and episode/event stay within
the cover height. Time belongs outside the card at left, forming the temporal
rail; verified availability may occupy the lower-right. Cards may wrap titles
rather than expanding to full timeline width. The day heading and ordered cards
form the timeline; no image is required for correctness. Day groups should be
visibly bounded as agenda sections. Their day heading and temporal rail use a
distinctive display face, while event details retain a high-legibility text face.

The focused event relies on the banner rather than duplicating the cover. The
contextual `TODAY` or `NEXT UP` label supplies the date; a divider separates
event identity from its time and verified availability link within the glass
panel.

Upcoming must remain useful even when every event has no imagery.

### Availability in event cards

`Where to watch` is an explicit availability concern, not an inferred label.
When a provider supplies a service and a page for the work, the card may show
that service in its lower-right corner. Use the provider icon when available,
then the service name. Absence of a usable service/page leaves the corner empty.

---

## 23. Discovery

Discovery is more visual than Upcoming because its purpose is exploration.

It may use cover artwork when providers expose it.

The primary user action is `Track`.

Typical Discovery content:

- provider search;
- Current: currently releasing media, ordered by provider popularity;
- Next season: media in the immediately following season, ordered chronologically;
- title/name;
- optional cover;
- optional icon;
- concise metadata;
- expected schedule/next event when known;
- consumption source when known;
- `Track` action.

`Next season` should exclude media without a sufficiently precise announced
release date. Discovery must not fill a chronological view with distant or
indeterminate releases merely because they exist in the provider catalog.

Avoid turning Discovery into a social/catalog analytics product.

Do not prioritize:

- user review counts;
- social activity;
- achievements;
- excessive ratings;
- recommendation complexity.

---

## 24. Tracking

Tracking shows only entities the user intentionally selected.

It should be more compact than Discovery.

The initial Anime view separates:

```text
AIRING
└── tracked entities with a next scheduled event

COMING SOON
└── tracked entities without a next scheduled event
```

`Coming soon` is a presentation grouping, not a claim that a release date is
known. Items without a date must say so explicitly. This generic separation
also works for future formats where the meaning of an event differs from an
Anime episode.

Primary information:

- entity identity;
- format;
- next upcoming event;
- next timestamp;
- consumption source when known;
- tracking state;
- optional entity-specific preferences.

Tracking is not a historical consumption library.

---

## 25. Event details

Event detail may be implemented as a drawer, modal, sheet, or dedicated route depending on framework ergonomics.

It should preserve structured information instead of reproducing concatenated names.

Example:

```text
Frieren

Episode 8
Tuesday, August 18
18:30

Watch on
Crunchyroll

Format
Anime

Type
Episode

Source provider
AniList

[ Mark as watched ]
```

`Mark as watched` may simply delete the local event in v0.1.

---

## 26. Visual design direction

The mockups are guidance, not pixel-perfect contracts.

### Character

Raven should feel:

- dark;
- precise;
- calm;
- observant;
- contemporary;
- low-noise;
- highly scannable.

It should **not** feel:

- medieval;
- fantasy-themed;
- gamer RGB;
- cyberpunk;
- card-dashboard heavy;
- editorial magazine-like.

### Typography

Avoid the serif-heavy direction from early mockups.

Prefer a modern grotesk/geometric sans direction.

Conceptual references:

- Space Grotesk-like headings;
- Manrope-like UI/body text;
- or another open, modern sans combination with similar personality.

Typography should add a subtle technical/observational identity without becoming futuristic decoration.

The v0.1 interface is English-only. Localization is a future presentation
concern; it must not require a domain-model change.

### Color

Suggested direction, not fixed tokens:

```text
Background      deep charcoal / blue-black
Surface         slightly lighter blue-charcoal
Primary text    warm off-white
Secondary text  muted cool gray
Accent          restrained violet / blue-violet
Anime signal    muted violet
Sports signal   muted green
Urgency/today   warm amber
Borders         subtle low-contrast lines
```

### Layout

Prefer:

- typography;
- spacing;
- thin dividers;
- compact contextual badges;
- intentional use of imagery.

Avoid wrapping every piece of information in a card.

Cards are acceptable where the interaction benefits from them, especially Discovery.

### Responsive behavior

v0.1 must be responsive.

However, desktop web receives the primary design attention during the initial implementation.

Mobile-specific refinement, PWA behavior and deeper mobile ergonomics may be addressed in later phases.

Do not create a desktop layout that is impossible to adapt responsively.

---

## 27. UI data must remain structured

UI composition must not leak back into the data model.

Example domain values:

```text
entity.name = "Frieren"
event.type = "episode"
event.episode_number = 8
```

Example UI rendering:

```text
Frieren
Episode 8
```

If a future design wants:

```text
Frieren · EP 8
```

that is a presentation change only.

For Anime title normalization, v0.1 prefers an English title when the provider
supplies one, then falls back to romaji and then the native title. Raven must
not automatically translate titles. Alternate provider titles may be retained
as provider metadata for a future display-language preference.

---

## 28. Error and provider degradation behavior

Raven depends on external providers but should degrade gracefully.

Expected behavior:

- Discovery provider unavailable: show a clear provider availability error, do not crash the application.
- Event sync fails: keep the last valid upcoming events and retry later.
- Provider rate-limited: back off and surface a non-blocking health state where appropriate.
- Artwork unavailable: render without artwork.
- Availability/watch source unavailable: render event without consumption-source information.
- External data malformed: reject/log only the affected record when possible.

Provider failure should not corrupt Tracking state.

---

## 29. Observability

Keep observability practical for a self-hosted single container.

Minimum expectations:

- structured application logs;
- provider sync logs;
- migration logs;
- health endpoint;
- clear startup/shutdown messages;
- errors include provider/entity context without leaking secrets.

Do not require an external observability stack.

---

## 30. Security

v0.1 is expected to be deployed behind the user's preferred network/reverse-proxy/auth solution if external exposure is required.

Raven should still follow normal application security practices:

- validate all provider/API input;
- escape rendered external text;
- never expose provider secrets to the frontend;
- avoid arbitrary remote code/content execution;
- apply safe outbound request timeouts;
- constrain redirects where relevant;
- keep dependencies updated;
- run container as non-root when practical.

Raven does not need to build a full identity platform into v0.1.

---

## 31. Testing priorities

Automated tests should prioritize domain and provider boundaries.

### Core

- clean event naming rules;
- Entity/Event separation;
- Tracking lifecycle;
- event deduplication;
- event cleanup;
- timezone normalization;
- provider-independent rendering DTOs.

### Provider

- external → normalized Entity mapping;
- external → normalized Event mapping;
- missing optional fields;
- missing artwork;
- missing icon;
- missing availability;
- schedule update handling;
- provider errors/rate limits.

### Persistence

- migrations;
- startup on empty `/data`;
- restart with existing database;
- idempotent sync;
- WAL/concurrency behavior where relevant.

### UI

- Upcoming with mixed formats;
- Upcoming with no imagery;
- Discovery cover/icon distinction;
- Tracking state;
- responsive layout smoke coverage.

---

## 32. Suggested v0.1 implementation sequence

A practical implementation order:

### Phase 1 — foundation

1. application skeleton;
2. Dockerfile / Compose;
3. `/data` volume;
4. SQLite connection;
5. migrations;
6. health endpoint;
7. core domain types.

### Phase 2 — Anime provider

1. AniList provider client;
2. validate live public schedule coverage, pagination and rate-limit headers;
3. anonymous discovery/search;
4. Entity normalization;
5. Event normalization;
6. upcoming airing schedule retrieval;
7. provider error handling and backoff.

### Phase 3 — Tracking

1. Track action;
2. persist Entity;
3. persist Tracking;
4. sync upcoming events for tracked entities;
5. untrack cleanup behavior.

### Phase 4 — Web UI

1. navigation shell;
2. Discovery;
3. Tracking;
4. Upcoming weekly timeline;
5. event detail / watched action;
6. responsive baseline.

### Phase 5 — lifecycle hardening

1. internal scheduler;
2. periodic provider sync;
3. idempotency;
4. stale event cleanup;
5. startup recovery;
6. provider failure states;
7. tests.

---

## 33. Future extensions

Raven should make these possible without requiring them today.

### Sports

Adds new providers, types and tracking preferences.

Potential event types:

```text
match
race
qualifying
sprint
fight
```

### Series / Movies

Potential provider family: TMDB or another replaceable media provider.

Potential event types:

```text
episode
season_premiere
release
```

### Games

Games are intentionally deferred because releases are structured but in-game events are less standardized.

Potential future approach:

- structured release provider;
- official news/event feeds;
- optional specialized adapters.

### Calendar output

Raven may eventually expose:

```text
/calendar.ics
```

This should be an output projection of tracked upcoming events.

Raven does not need to become a CalDAV server.

Apple Calendar, Google Calendar, Outlook or other clients remain responsible for calendar UX and native notifications.

### Notifications

Notifications may later be generated from Raven events, but they are independent from event existence.

An event being visible does not imply that it should notify the user.

---

## 34. Architectural invariants

These should be treated as hard rules unless a future architecture decision explicitly changes them.

1. **Raven is Docker-first.**
2. **v0.1 runs as one application container.**
3. **SQLite is the intended default database.**
4. **External provider accounts are not required for basic usage when avoidable.**
5. **External catalog data should not be mirrored unnecessarily.**
6. **Discovery and Tracking remain separate concepts.**
7. **Tracking represents interest, not consumption history.**
8. **Events are structured and may be ephemeral.**
9. **Event names must never be polluted with structured metadata.**
10. **Entity and Event are separate domain concepts.**
11. **Cover and icon are separate visual/data concepts.**
12. **Providers are adapters, not owners of Raven's domain.**
13. **The UI renders domain data; it does not define domain storage.**
14. **Provider failure must not destroy local Tracking state.**
15. **New entertainment formats should extend Raven primarily through providers and event types rather than core rewrites.**
16. **Providers may be extracted into services later, but Raven core owns Tracking and normalized domain semantics.**

---

## 35. v0.1 success criteria

The first version is successful if a fresh self-hosted Raven instance can:

1. start with a simple Docker deployment;
2. initialize its local SQLite database automatically;
3. open a responsive Raven Web UI;
4. search/browse anime without requiring the user to create or connect an AniList account;
5. show provider-supplied metadata without requiring manual catalog authoring;
6. let the user track an anime;
7. retrieve and persist upcoming episode events;
8. show tracked entities separately from Discovery;
9. show upcoming tracked events chronologically on Upcoming;
10. mark an event as watched and safely remove that event;
11. keep tracking the entity after an individual event is removed;
12. recover cleanly after container restart;
13. tolerate temporary provider failure without corrupting local state.

If this flow is pleasant and reliable, Raven's core product hypothesis is validated.

---

## 36. Summary

Raven is a small self-hosted observation hub built around one idea:

> Raven knows what exists through providers. The user tells Raven what matters. Raven tells the user when it happens.

Its architecture should remain correspondingly small:

```text
              External Provider
                      │
                      ↓
                  Provider
                      │
                  normalize
                      ↓
       ┌──────────────────────────┐
       │          Raven           │
       │                          │
       │ Entity                   │
       │ Tracking                 │
       │ Event                    │
       │ Settings                 │
       │                          │
       │ SQLite /data/raven.db    │
       └────────────┬─────────────┘
                    │
          ┌─────────┼─────────┐
          ↓         ↓         ↓
      Upcoming  Discovery  Tracking
```

Keep the core small. Keep provider knowledge at the edges. Keep events structured. Keep local state meaningful. Add new media formats only when they justify their complexity.
