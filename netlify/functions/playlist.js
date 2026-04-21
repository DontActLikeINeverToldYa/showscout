function parseCookies(cookieHeader) {
  const out = {}
  if (!cookieHeader) return out
  const parts = cookieHeader.split(';')
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=')
    if (!k) continue
    out[k] = decodeURIComponent(rest.join('=') || '')
  }
  return out
}

import { logWithContext, withRequestIdBody, withRequestIdHeaders } from './_log.js'

async function getSpotifyAccessTokenFromRefreshToken(refreshToken) {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials.')
  }

  if (!refreshToken) {
    const err = new Error('Not connected to Spotify.')
    err.statusCode = 401
    throw err
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    const err = new Error('Failed to refresh Spotify session.')
    err.statusCode = 401
    err.spotify = data
    throw err
  }

  return data.access_token
}

async function spotifyFetchJson({ token, url }) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await res.json().catch(() => ({}))
  return { res, data }
}

export async function handler(event) {
  try {
    const playlistId = event.queryStringParameters?.playlistId

    if (!playlistId) {
      return {
        statusCode: 400,
        headers: withRequestIdHeaders(event),
        body: JSON.stringify(withRequestIdBody(event, { error: 'Missing playlistId.' })),
      }
    }

    const cookies = parseCookies(event.headers?.cookie)
    const refreshToken = cookies.spotify_refresh_token

    logWithContext({
      event,
      level: 'info',
      message: 'playlist.request',
      meta: { playlistId, hasRefreshToken: Boolean(refreshToken) },
    })

    const token = await getSpotifyAccessTokenFromRefreshToken(refreshToken)

    const playlistUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(
      playlistId,
    )}?additional_types=track`

    const { res: pres, data: pdata } = await spotifyFetchJson({ token, url: playlistUrl })

    if (pres.status === 404) {
      return {
        statusCode: 404,
        headers: withRequestIdHeaders(event),
        body: JSON.stringify(withRequestIdBody(event, { error: 'Playlist not found. Make sure it is public.' })),
      }
    }

    if (!pres.ok) {
      const spotifyError = pdata?.error
      const spotifyMessage = spotifyError?.message
      logWithContext({
        event,
        level: 'error',
        message: 'spotify.playlist.metadata_error',
        meta: { status: pres.status, spotify: spotifyError || null },
      })
      return {
        statusCode: pres.status,
        headers: withRequestIdHeaders(event),
        body: JSON.stringify(withRequestIdBody(event, {
          error: spotifyMessage
            ? `Spotify playlist error (${pres.status}): ${spotifyMessage}`
            : 'Failed to load playlist. Make sure it is public.',
          spotify: spotifyError || null,
        })),
      }
    }

    let trackCount = typeof pdata?.tracks?.total === 'number' ? pdata.tracks.total : 0
    const imageUrl = Array.isArray(pdata?.images) && pdata.images.length > 0 ? pdata.images[0]?.url : null

    const counts = new Map()

    const consumeItems = (items) => {
      for (const item of items) {
        const trackOrItem = item?.item || item?.track
        const artists = trackOrItem?.artists
        if (!Array.isArray(artists)) continue
        for (const a of artists) {
          if (!a?.name) continue
          const key = a?.id ? `id:${a.id}` : `name:${a.name}`
          const prev = counts.get(key) || { id: a?.id ?? null, name: a.name, trackCount: 0 }
          counts.set(key, { ...prev, trackCount: prev.trackCount + 1 })
        }
      }
    }

    let offset = 0
    const limit = 100

    let analyzedTrackCount = 0
    let itemsTotal = null
    let sampleItem = null

    while (true) {
      const url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(
        playlistId,
      )}/items?limit=${limit}&offset=${offset}&market=from_token&additional_types=track`

      const { res, data } = await spotifyFetchJson({ token, url })
      if (res.status === 404) {
        return {
          statusCode: 404,
          headers: withRequestIdHeaders(event),
          body: JSON.stringify(withRequestIdBody(event, { error: 'Playlist not found.' })),
        }
      }

      if (!res.ok) {
        const spotifyError = data?.error
        const spotifyMessage = spotifyError?.message

        logWithContext({
          event,
          level: 'error',
          message: 'spotify.playlist.items_error',
          meta: { status: res.status, playlistId, offset, limit, spotify: spotifyError || data || null },
        })

        return {
          statusCode: res.status,
          headers: withRequestIdHeaders(event),
          body: JSON.stringify(withRequestIdBody(event, {
            error: spotifyMessage
              ? `Spotify playlist tracks error (${res.status}): ${spotifyMessage}`
              : 'Failed to load playlist tracks.',
            spotify: spotifyError || data || null,
          })),
        }
      }

      const items = Array.isArray(data?.items) ? data.items : []
      if (itemsTotal === null && typeof data?.total === 'number') itemsTotal = data.total
      if (!sampleItem && items.length > 0) sampleItem = items[0]
      analyzedTrackCount += items.length
      consumeItems(items)
      if (items.length < limit) break
      offset += limit
    }

    if (!trackCount && typeof itemsTotal === 'number') trackCount = itemsTotal
    if (!trackCount) trackCount = analyzedTrackCount

    const artists = Array.from(counts.values()).sort((a, b) => b.trackCount - a.trackCount)

    return {
      statusCode: 200,
      headers: withRequestIdHeaders(event),
      body: JSON.stringify(withRequestIdBody(event, {
        playlist: {
          id: playlistId,
          name: pdata?.name ?? 'Untitled playlist',
          imageUrl,
          trackCount,
          analyzedTrackCount,
        },
        artists,
        debug: artists.length === 0 ? { sampleItem } : undefined,
      })),
    }
  } catch (e) {
    const statusCode = e?.statusCode || 500

    logWithContext({
      event,
      level: 'error',
      message: 'playlist.unhandled_error',
      meta: { statusCode, error: e?.message || String(e), spotify: e?.spotify || null },
    })

    return {
      statusCode,
      headers: withRequestIdHeaders(event),
      body: JSON.stringify(
        withRequestIdBody(event, { error: e?.message || 'Unexpected error.', spotify: e?.spotify || null }),
      ),
    }
  }
}
