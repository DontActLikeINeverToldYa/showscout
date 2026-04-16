# SPEC: ShowScout — Spotify Playlist Concert Finder

## One-Liner
Paste a Spotify playlist URL, pick a city, see which artists are playing live nearby — powered by Eventim's concert database.

---

## Problem
You have a Spotify playlist with hundreds of tracks. Some of those artists are touring through your city — but you'd never know unless you manually searched Eventim, venue websites, and social media one by one. By the time you hear about a show, it's sold out.

## Solution
A web app that reads a public Spotify playlist, extracts all unique artists, queries Eventim's public API for upcoming events in the selected city, and shows a date-sorted list of matches with direct ticket links.

## User
Music fans in Germany, Austria, and Switzerland who maintain Spotify playlists and want a single view of upcoming concerts by artists they actually listen to.

---

## Core Product Decisions

### No Spotify Login Required
Users do NOT authenticate with Spotify. Instead:
- User pastes a **public** playlist URL
- App uses Spotify **Client Credentials** flow (app authenticates, not the user)
- This means: no OAuth popup, no permissions dialog, no user data stored
- **Tradeoff**: Only public playlists work. The UI must clearly communicate this: *"Make sure your playlist is set to public in Spotify"*

### Eventim as Concert Data Source
After testing Ticketmaster (zero German concert data), Bandsintown (API locked to single-artist keys), and Songkick (API shut down), we validated that **Eventim's undocumented public API** returns comprehensive German/Austrian/Swiss concert data with no API key required.

**Validated endpoint:**
```
GET https://public-api.eventim.com/websearch/search/api/exploration/v1/products
    ?webId=web__eventim-de
    &language=de
    &retail_partner=EVE
    &search_term={artist_name}
    &city_names={city}
    &sort=DateAsc
    &top=10
```

**What it returns per event:**
- `name` — event/tour name
- `typeAttributes.liveEntertainment.startDate` — ISO datetime
- `typeAttributes.liveEntertainment.location.name` — venue name
- `typeAttributes.liveEntertainment.location.city` — city name
- `attractions[].name` — clean artist name (used for matching)
- `price` / `currency` — ticket price (when available)
- `link` — direct Eventim ticket purchase URL
- `status` — "Available" / "SoldOut"
- `categories` — event type (Konzerte > Rock & Pop, etc.)

**Risk:** This is an undocumented API that could change without notice. Acceptable for a portfolio/personal project, not for a business.

### City Selection via Dropdown
No radius-based search. Users pick from a preset dropdown of major cities:
- **Germany:** München, Berlin, Hamburg, Köln, Frankfurt, Stuttgart, Düsseldorf, Leipzig, Nürnberg, Dresden
- **Austria:** Wien, Salzburg, Innsbruck, Graz
- **Switzerland:** Zürich, Basel, Bern

The Eventim API uses `city_names` parameter with German city names (e.g. "München" not "Munich").

### Shareable URLs
Results are shareable via URL parameters:
```
showscout.netlify.app?playlist=https://open.spotify.com/playlist/37i9dQZF1DX...&city=München
```
When someone opens a shared link, the app auto-runs the search with those parameters.

---

## Functional Requirements

### 1. Playlist Input
- User pastes a Spotify playlist URL into an input field
- Accept format: `https://open.spotify.com/playlist/{id}` (with optional query params)
- Parse the playlist ID from the URL
- Display clear messaging: playlist must be set to public
- Show playlist name, cover image, and track count after loading

### 2. City Selection
- Dropdown with preset cities (see list above)
- Default: München
- City selection persists across searches (store in URL params)

### 3. Artist Extraction
- Call Spotify API: `GET /playlists/{id}/tracks` using Client Credentials token
- Handle pagination (API returns max 100 per call, playlists can have 1000+ tracks)
- Extract all artist objects from each track
- Deduplicate by Spotify artist ID
- **Track frequency**: count how many tracks each artist has in the playlist
- Display: "Found {X} unique artists in {Y} tracks"

### 4. Concert Lookup
- For each unique artist, query Eventim public API with `search_term` + `city_names`
- **Artist matching**: verify that `attractions[].name` in the response matches the queried artist (case-insensitive). The search_term is a keyword search — it may return unrelated results
- **Parallel batching**: send 5 concurrent requests at a time to balance speed and politeness
- **No artificial cap**: search all artists regardless of playlist size
- Show progress: "Checking artist 47 of 183..."
- Results stream in as they're found (don't wait for all queries to finish)

### 5. Results Display
- **Date-sorted list** with visual highlight for high-frequency artists (artists with more tracks in the playlist get a subtle visual emphasis, e.g. bolder text or a small badge showing track count)
- Each row shows:
  - **Date** — formatted as "Mi, 15. Apr 2026" (German locale, include day of week)
  - **Artist name** — with track count from playlist (e.g. "The Vaccines · 4 tracks")
  - **Event/Tour name** — if different from artist name
  - **Venue + City** — e.g. "Muffatwerk, München"
  - **Price** — if available (e.g. "ab €44,00")
  - **Status** — Available / SoldOut badge
  - **Ticket link** — button linking to the Eventim page
- Multiple dates for same artist = separate rows
- Show summary: "{X} concerts found for {Y} of your {Z} artists"
- **Unmatched artists section**: collapsible section at bottom showing "Couldn't find events for X artists" — so users know it tried

### 6. Loading State
- Progress indicator: "Checking artist 47 of 183..."
- Results appear incrementally as found
- Skeleton loading state before first results arrive

### 7. Error Handling
- Playlist not found / not public → clear message with instructions to make it public
- Eventim API down → show error, suggest trying again later
- Individual artist lookup fails → skip and continue, don't break the flow
- Invalid playlist URL → inline validation message

---

## Out of Scope (V1)
- User accounts / saving results
- Multiple playlists at once
- Push notifications for new concerts
- Calendar integration (Google Calendar, .ics export)
- Price comparison across vendors
- "Similar artists" recommendations
- Native mobile app (responsive web is fine)
- Filtering by genre, venue, or price
- Sorting options beyond date
- Private playlist support (would require OAuth)
- Non-DACH markets (Eventim coverage is DE/AT/CH)

---

## Technical Architecture

### Stack
- **Frontend**: React + Vite (single-page app)
- **Styling**: Tailwind CSS
- **Serverless Backend**: Netlify Functions (needed to proxy Spotify Client Credentials and hide client secret)
- **APIs**: Spotify Web API (Client Credentials) + Eventim Public API
- **Caching**: Upstash Redis (free tier) — cache artist+city event lookups, 24h TTL
- **Hosting**: Netlify (free tier, auto-deploy from GitHub)

### API Flow
```
Browser                     Netlify Functions              External APIs
  │                              │                              │
  ├─ paste playlist URL ──────>  │                              │
  │                              ├─ Client Credentials ──────> Spotify
  │                              │  (uses SPOTIFY_CLIENT_SECRET)│
  │                              │ <─── access_token ──────────┤
  │                              ├─ GET /playlists/{id}/tracks > Spotify
  │ <── artist list ────────────┤                              │
  │                              │                              │
  ├─ search artist+city ──────> │                              │
  │                              ├─ check Redis cache           │
  │                              │  (hit? return cached)        │
  │                              ├─ GET /exploration/v1/products > Eventim
  │                              │ <─── events ────────────────┤
  │                              ├─ write to Redis (24h TTL)    │
  │ <── concert results ────────┤                              │
```

### Why Netlify Functions (not pure client-side)
1. **Spotify Client Credentials** requires a `client_secret` — this CANNOT be exposed in frontend code
2. **Caching layer** — Redis sits server-side, preventing redundant Eventim API calls
3. **CORS** — Eventim's public API may not set CORS headers for browser requests; serverless functions bypass this

### API Keys Required
1. **Spotify**: Create app at https://developer.spotify.com/dashboard
   - Note the `Client ID` and `Client Secret`
   - No redirect URI needed (Client Credentials flow, not user OAuth)
   - Stored as environment variables in Netlify: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
2. **Eventim**: No API key needed (public endpoint)
3. **Upstash Redis**: Create free database at https://upstash.com
   - Stored as: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### Key Technical Decisions
- **Netlify over Vercel**: chosen for simpler serverless function setup
- **No Spotify OAuth**: Client Credentials = simpler UX, no login popup, but only public playlists
- **Eventim over Ticketmaster**: Ticketmaster has zero German concert data. Eventim IS the German market
- **Per-artist search**: one Eventim API call per artist (with city filter) rather than bulk search. Cleaner matching, acceptable performance with parallel batching
- **24h cache TTL**: concert data doesn't change minute-to-minute. Caching reduces Eventim API load and speeds up repeated searches
- **Artist frequency weighting**: visual emphasis in results, not a sort order change. Date sort remains primary

---

## UI Design Direction

### Aesthetic
Dark theme. Music/nightlife feel — not corporate dashboard. Think Spotify meets a concert poster wall.

### Layout
```
┌──────────────────────────────────────────────────┐
│  🎤 ShowScout                                     │
│  Find concerts from your playlists               │
├──────────────────────────────────────────────────┤
│                                                  │
│  [Paste Spotify playlist URL here          ] [→] │
│  ℹ️ Playlist must be set to public               │
│                                                  │
│  City: [München ▾]                               │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ 🎧 Road Trip Bangers — 342 tracks         │  │
│  │    Found 187 unique artists               │  │
│  │    Checking concerts... 94/187 ████████░░  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  🎶 12 concerts found for 8 of your 187 artists  │
│  ─────────────────────────────────────────────── │
│                                                  │
│  Mi, 15. Apr     The Vaccines · 4 tracks    ★   │
│  2026            Muffatwerk, München             │
│                  ab €44,00          [Tickets →]  │
│                                                  │
│  Fr, 17. Apr     The Vaccines · 4 tracks    ★   │
│  2026            Huxleys Neue Welt, Berlin       │
│                  ab €44,50          [Tickets →]  │
│                                                  │
│  Sa, 18. Apr     Subway to Sally · 2 tracks     │
│  2026            Backstage, München              │
│                  ab €50,45          [Tickets →]  │
│                                                  │
│  ▸ Couldn't find events for 179 artists          │
│                                                  │
│  🔗 Share these results [Copy Link]              │
│                                                  │
└──────────────────────────────────────────────────┘
```

### States
1. **Landing** — Logo, tagline, playlist input, city dropdown. Clean and minimal.
2. **Loading** — Progress bar with artist count. Results stream in below.
3. **Results** — Date-sorted list with frequency highlights. Summary stats at top. Share button.
4. **Empty** — Friendly message if no concerts found for any artist.
5. **Error** — Clear messages for: playlist not public, playlist not found, API errors.

---

## File Structure
```
showscout/
├── index.html
├── package.json
├── vite.config.js
├── .env.example              ← see below
├── .env                      ← gitignored, actual secrets
├── .gitignore
├── README.md
├── SPEC.md                   ← this file
├── netlify.toml              ← Netlify build config + functions directory
├── public/
│   └── favicon.svg
├── netlify/
│   └── functions/
│       ├── spotify-token.js    ← Client Credentials token exchange
│       ├── playlist.js         ← fetch playlist tracks via Spotify API
│       └── concerts.js         ← query Eventim API + Redis cache
└── src/
    ├── main.jsx
    ├── App.jsx                 ← main app, URL param handling, state machine
    ├── components/
    │   ├── PlaylistInput.jsx     ← URL input + public playlist notice
    │   ├── CitySelector.jsx      ← dropdown with preset cities
    │   ├── ProgressBar.jsx       ← "Checking artist X of Y"
    │   ├── ConcertList.jsx       ← the results list
    │   ├── ConcertCard.jsx       ← single concert row with frequency badge
    │   ├── UnmatchedArtists.jsx  ← collapsible "no events found" section
    │   └── ShareButton.jsx       ← copy shareable URL
    ├── hooks/
    │   ├── usePlaylist.js        ← fetch playlist + extract artists + count frequency
    │   └── useConcertSearch.js   ← Eventim queries via Netlify function + parallel batching
    ├── utils/
    │   ├── spotify.js            ← playlist URL parsing, artist deduplication
    │   ├── eventim.js            ← Eventim response parsing, artist matching
    │   ├── cities.js             ← city list with German names
    │   └── url.js                ← shareable URL construction + parsing
    └── styles/
        └── globals.css           ← Tailwind + custom dark theme
```

---

## Environment Variables

### .env.example
```bash
# Spotify (get from https://developer.spotify.com/dashboard)
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here

# Upstash Redis (get from https://upstash.com)
UPSTASH_REDIS_REST_URL=your_redis_url_here
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here

# No Eventim key needed — public API
```

---

## Acceptance Criteria

- [ ] User can paste a public Spotify playlist URL and see playlist metadata (name, image, track count)
- [ ] App extracts and deduplicates artists, showing track frequency per artist
- [ ] User can select a city from the dropdown (default: München)
- [ ] App queries Eventim for each artist in the selected city
- [ ] Artist matching validates `attractions[].name` against the queried artist
- [ ] Results appear incrementally as queries complete
- [ ] Progress indicator shows "Checking artist X of Y"
- [ ] Results are sorted by date ascending
- [ ] High-frequency artists have visual emphasis in results
- [ ] Each result shows: date, artist (with track count), venue, city, price, ticket link, status
- [ ] Unmatched artists are shown in a collapsible section
- [ ] Shareable URL works (paste URL with params → auto-runs search)
- [ ] Clear error message when playlist is not public or not found
- [ ] Individual artist lookup failures don't break the overall flow
- [ ] Results are cached (same artist+city query returns cached data within 24h)
- [ ] Works on Chrome, Safari, Firefox (latest versions)
- [ ] Responsive (works on mobile, but desktop-primary)
- [ ] Deployed on Netlify with working production URL

---

## Implementation Notes for the AI Agent

1. **Spotify Client Credentials flow**: POST to `https://accounts.spotify.com/api/token` with `grant_type=client_credentials`, Base64-encoded `client_id:client_secret` in Authorization header. This returns an access token (no user context). Use this token for `GET /playlists/{id}/tracks`. This MUST happen in a Netlify Function (server-side) to protect the client secret.

2. **Eventim artist matching**: The `search_term` parameter is a keyword search, not an exact artist filter. Always verify that `attractions[].name` in the response matches the queried artist (case-insensitive, trimmed). Discard non-matching results.

3. **Eventim city names**: Use German names exactly as Eventim expects: "München" not "Munich", "Köln" not "Cologne", "Wien" not "Vienna". The `cities.js` util should map display names to Eventim API values.

4. **Parallel batching**: Use a concurrency limit of 5 (e.g. with p-limit or manual Promise batching). Don't fire 200 requests simultaneously — be polite to the Eventim API.

5. **Pagination**: Spotify returns max 100 tracks per request. A playlist with 500 tracks needs 5 API calls using the `offset` parameter.

6. **Playlist URL parsing**: Extract playlist ID from URLs like `https://open.spotify.com/playlist/37i9dQZF1DX...?si=abc123`. Strip query params, extract the ID segment.

7. **Cache key format**: `eventim:{artist_name_lowercase}:{city_name_lowercase}` with 24h TTL. Use Upstash REST API (no Redis client library needed — just fetch calls).

8. **Error boundaries**: Wrap each artist lookup in try/catch. A single failed lookup should log the error, add the artist to the "unmatched" list, and continue with the next artist.

9. **Netlify Functions**: Use `netlify/functions/` directory. Each function is a single JS file exporting a handler. Configure in `netlify.toml`. Functions can access env vars directly via `process.env`.

---

## Eventim API Reference (Validated April 2026)

### Search Events
```
GET https://public-api.eventim.com/websearch/search/api/exploration/v1/products
```

**Parameters:**
| Param | Required | Example | Notes |
|-------|----------|---------|-------|
| webId | Yes | `web__eventim-de` | Always use this value |
| language | Yes | `de` | German results |
| retail_partner | Yes | `EVE` | Always use this value |
| search_term | No | `The Vaccines` | Artist/event keyword search |
| city_names | No | `München` | German city name, exact match |
| sort | No | `DateAsc` | Options: DateAsc, DateDesc, NameAsc, NameDesc, Rating, Recommendation |
| top | No | `10` | Results per page (max 50) |
| page | No | `1` | Pagination |

**Response shape (key fields):**
```json
{
  "products": [
    {
      "productId": "20833180",
      "name": "The Vaccines - Anniversary Tour 2026",
      "status": "Available",
      "link": "https://www.eventim.de/event/...",
      "price": 44.00,
      "currency": "EUR",
      "inStock": true,
      "typeAttributes": {
        "liveEntertainment": {
          "startDate": "2026-04-15T20:00:00+02:00",
          "location": {
            "name": "Muffatwerk",
            "city": "München"
          }
        }
      },
      "attractions": [{ "name": "The Vaccines" }],
      "categories": [
        { "name": "Konzerte" },
        { "name": "Rock & Pop", "parentCategory": { "name": "Konzerte" } }
      ]
    }
  ],
  "totalResults": 3,
  "page": 1,
  "totalPages": 1
}
```

---

## Future Ideas (Post-V1)
- n8n workflow: weekly scheduled check → email digest of new concerts for your playlist
- Calendar export (.ics download)
- Filter by genre, venue, price range
- Multiple playlist support
- "Alert me" — notify when a new concert is announced for a playlist artist
- Private playlist support (add Spotify OAuth as optional upgrade)
- Bandsintown as secondary data source if they open API access
- pyventim integration for richer Eventim data (seat maps, availability details)
- Price tracking / sold-out alerts
