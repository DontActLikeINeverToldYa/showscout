import { useCallback, useState } from 'react'

export default function usePlaylist() {
  const [state, setState] = useState('idle')
  const [error, setError] = useState(null)
  const [playlist, setPlaylist] = useState(null)
  const [artists, setArtists] = useState([])

  const loadPlaylist = useCallback(async (playlistId) => {
    setState('loading')
    setError(null)
    setPlaylist(null)
    setArtists([])

    try {
      const res = await fetch(`/.netlify/functions/playlist?playlistId=${encodeURIComponent(playlistId)}`)
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Connect Spotify to load playlist tracks.')
        }
        throw new Error(data?.error || 'Failed to load playlist.')
      }

      setPlaylist(data.playlist)
      setArtists(data.artists)
      setState('loaded')
    } catch (e) {
      setError(e?.message || 'Failed to load playlist.')
      setState('error')
    }
  }, [])

  return { state, error, playlist, artists, loadPlaylist }
}
