import { useMemo } from 'react'
import { parseSpotifyPlaylistId } from '../utils/spotify.js'

export default function PlaylistInput({ value, onChange, onSubmit, loading }) {
  const validation = useMemo(() => parseSpotifyPlaylistId(value), [value])
  const canSubmit = validation.ok && !loading

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-zinc-200">Spotify playlist</label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://open.spotify.com/playlist/..."
          className="h-10 w-full rounded-xl bg-zinc-950/40 px-3 text-sm text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="h-10 shrink-0 rounded-xl bg-zinc-100 px-4 text-sm font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
      </div>
      <div className="text-xs text-zinc-500">Connect Spotify to load playlist tracks.</div>
      {!validation.ok && value.trim().length > 0 && (
        <div className="text-xs text-red-300">{validation.error}</div>
      )}
    </div>
  )
}
