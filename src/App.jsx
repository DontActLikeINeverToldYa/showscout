import { useEffect, useMemo, useState } from 'react'
import PlaylistInput from './components/PlaylistInput.jsx'
import CitySelector from './components/CitySelector.jsx'
import ProgressBar from './components/ProgressBar.jsx'
import ConcertList from './components/ConcertList.jsx'
import ShareButton from './components/ShareButton.jsx'
import { CITIES, DEFAULT_CITY } from './utils/cities.js'
import { getSearchParams, setSearchParams } from './utils/url.js'
import { parseSpotifyPlaylistId } from './utils/spotify.js'
import usePlaylist from './hooks/usePlaylist.js'
import useConcertSearch from './hooks/useConcertSearch.js'

export default function App() {
  const initial = useMemo(() => getSearchParams(window.location.search), [])

  const [playlistInput, setPlaylistInput] = useState(initial.playlist ?? '')
  const [city, setCity] = useState(initial.city && CITIES.includes(initial.city) ? initial.city : DEFAULT_CITY)
  const [playlistId, setPlaylistId] = useState(initial.playlist ?? '')
  const [connectedBanner, setConnectedBanner] = useState(false)

  const {
    state: playlistState,
    error: playlistError,
    requestId: playlistRequestId,
    playlist,
    artists,
    loadPlaylist,
  } = usePlaylist()

  const {
    state: searchState,
    progress,
    results,
    error: concertsError,
    requestId: concertsRequestId,
    startSearch,
    reset: resetConcertSearch,
  } = useConcertSearch()

  const debugInfo = useMemo(
    () =>
      JSON.stringify(
        {
          playlistId: playlistId || null,
          city,
          playlistState,
          searchState,
          playlistRequestId: playlistRequestId || null,
          concertsRequestId: concertsRequestId || null,
          playlistError: playlistError || null,
          concertsError: concertsError || null,
        },
        null,
        2,
      ),
    [
      playlistId,
      city,
      playlistState,
      searchState,
      playlistRequestId,
      concertsRequestId,
      playlistError,
      concertsError,
    ],
  )

  const copyDebugInfo = async () => {
    try {
      await navigator.clipboard.writeText(debugInfo)
    } catch {
      // Ignore.
    }
  }

  useEffect(() => {
    setSearchParams({ playlist: playlistId || undefined, city })
  }, [playlistId, city])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === '1') {
      setConnectedBanner(true)
      params.delete('connected')
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
      window.setTimeout(() => setConnectedBanner(false), 2500)
    }
  }, [])

  useEffect(() => {
    if (!initial.playlist) return
    if (!initial.city) return

    // Auto-run when opened via share link.
    // `initial.playlist` is a playlist ID (not a full URL).
    loadPlaylist(initial.playlist)
  }, [initial.playlist, initial.city, loadPlaylist])

  useEffect(() => {
    if (playlistState !== 'loaded') return
    resetConcertSearch()
    startSearch({ artists, city })
  }, [playlistState, artists, city, resetConcertSearch, startSearch])

  const onSubmit = () => {
    const parsed = parseSpotifyPlaylistId(playlistInput)
    if (!parsed.ok) return

    setPlaylistId(parsed.playlistId)
    loadPlaylist(parsed.playlistId)
  }

  const canShare = playlistState === 'loaded' && playlistId

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <header className="mb-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 ring-1 ring-zinc-800" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">ShowScout</h1>
              <p className="text-sm text-zinc-400">Find concerts from your playlists</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4">
          <div className="rounded-2xl bg-zinc-900/40 p-4 ring-1 ring-zinc-800">
            {connectedBanner && (
              <div className="mb-3 rounded-xl bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-900">
                Connected to Spotify.
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <PlaylistInput
                value={playlistInput}
                onChange={setPlaylistInput}
                onSubmit={onSubmit}
                loading={playlistState === 'loading'}
              />
              <CitySelector value={city} onChange={setCity} />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-500">Spotify login is required to read playlist tracks.</div>
              <a
                href="/.netlify/functions/spotify-login"
                className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-100 px-3 text-xs font-medium text-zinc-950"
              >
                Connect Spotify
              </a>
            </div>

            {(playlistError || concertsError) && (
              <div className="mt-3 rounded-xl bg-red-950/40 px-3 py-2 text-sm text-red-200 ring-1 ring-red-900">
                {playlistError || concertsError}
                {(String(playlistError || '').includes('(403)') ||
                  String(playlistError || '').toLowerCase().includes('connect spotify')) && (
                  <div className="mt-2">
                    <a href="/.netlify/functions/spotify-login?force=1" className="underline">
                      Reconnect Spotify
                    </a>
                  </div>
                )}
                {(playlistRequestId || concertsRequestId) && (
                  <div className="mt-2 text-xs text-red-200/80">
                    Request ID: {playlistRequestId || concertsRequestId}
                  </div>
                )}
                <div className="mt-2">
                  <button type="button" onClick={copyDebugInfo} className="underline">
                    Copy debug info
                  </button>
                </div>
              </div>
            )}

            {playlist && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-zinc-950/30 p-3 ring-1 ring-zinc-800">
                {playlist.imageUrl ? (
                  <img
                    alt={playlist.name}
                    src={playlist.imageUrl}
                    className="h-14 w-14 rounded-lg object-cover ring-1 ring-zinc-800"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">🎧 {playlist.name}</div>
                  <div className="text-xs text-zinc-400">
                    Found {artists.length} unique artists in {playlist.analyzedTrackCount ?? playlist.trackCount} tracks
                  </div>
                </div>

                <ShareButton disabled={!canShare} playlistId={playlistId} city={city} />
              </div>
            )}

            {(playlistState === 'loaded' || playlistState === 'loading') && (
              <div className="mt-4">
                <ProgressBar
                  state={searchState}
                  current={progress.current}
                  total={progress.total}
                  concertsFound={results.length}
                />
              </div>
            )}
          </div>

          <ConcertList results={results} />

          {(playlistState === 'loaded' && searchState === 'idle') && results.length === 0 && (
            <div className="rounded-2xl bg-zinc-900/40 p-6 text-sm text-zinc-300 ring-1 ring-zinc-800">
              No concerts found yet. Start by pasting a Spotify playlist.
            </div>
          )}
        </div>

        <footer className="mt-10 text-xs text-zinc-500">
          Uses Spotify (OAuth) + Eventim public search API.
        </footer>
      </div>
    </div>
  )
}
