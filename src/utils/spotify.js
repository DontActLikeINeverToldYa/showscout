export function parseSpotifyPlaylistId(input) {
  const raw = (input || '').trim()
  if (!raw) return { ok: false, error: 'Please paste a playlist URL.' }

  // If it already looks like an ID, accept it.
  if (/^[A-Za-z0-9]{10,}$/.test(raw) && !raw.includes('/')) {
    return { ok: true, playlistId: raw }
  }

  let url
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: 'Invalid playlist URL.' }
  }

  if (url.hostname !== 'open.spotify.com') {
    return { ok: false, error: 'Please use an open.spotify.com playlist URL.' }
  }

  const parts = url.pathname.split('/').filter(Boolean)
  const type = parts[0]
  const id = parts[1]

  if (type !== 'playlist' || !id) {
    return { ok: false, error: 'Playlist URL must look like https://open.spotify.com/playlist/{id}' }
  }

  return { ok: true, playlistId: id }
}
