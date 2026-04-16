# 🎤 ShowScout

**Paste a Spotify playlist. See who's playing live in your city.**

ShowScout reads your public Spotify playlist, finds every unique artist, and checks Eventim for upcoming concerts in your selected city across Germany, Austria, and Switzerland.

## How It Works

1. Paste a public Spotify playlist URL
2. Pick your city (München, Berlin, Hamburg, Wien, Zürich, and more)
3. ShowScout checks each artist against Eventim's concert database
4. See a date-sorted list of upcoming shows with direct ticket links

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Netlify Functions (serverless)
- **Concert Data**: Eventim public API (no key required)
- **Music Data**: Spotify Web API (Client Credentials flow)
- **Caching**: Upstash Redis (24h TTL per artist+city query)
- **Hosting**: Netlify

## Getting Started

### Prerequisites
- Node.js 18+
- A Spotify Developer account ([create app here](https://developer.spotify.com/dashboard))
- An Upstash account ([free tier here](https://upstash.com))
- Netlify CLI (`npm install -g netlify-cli`)

### Setup
```bash
git clone https://github.com/YOUR_USERNAME/showscout.git
cd showscout
npm install
cp .env.example .env
```

Edit `.env` with your credentials:
```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

### Run locally
```bash
netlify dev
```

### Deploy
```bash
netlify deploy --prod
```

## Architecture

No Spotify login required — users just paste a playlist URL. The app uses Spotify's Client Credentials flow (server-side) to read public playlists, then queries Eventim's public search API for each artist in the selected city.

Results are cached in Redis for 24 hours to avoid redundant API calls.

## Why Eventim?

Ticketmaster's API returns zero German concert data. Bandsintown locked their API to single-artist keys. Songkick shut down their API entirely. Eventim is Europe's largest ticketing platform and their public search endpoint returns comprehensive concert data for the DACH market — no API key needed.

## License

MIT

## Built With

Spec-driven development using AI-assisted tooling. See [SPEC.md](./SPEC.md) for the full product specification.
