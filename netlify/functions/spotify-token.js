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

export async function handler(event) {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing Spotify credentials.' }),
      }
    }

    const cookies = parseCookies(event.headers?.cookie)
    const refreshToken = cookies.spotify_refresh_token
    if (!refreshToken) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not connected to Spotify.' }) }
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
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Failed to refresh Spotify session.', spotify: data?.error || data }),
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ access_token: data.access_token, expires_in: data.expires_in }),
    }
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected error.' }) }
  }
}
