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

export async function handler(event) {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return {
        statusCode: 500,
        headers: withRequestIdHeaders(event),
        body: JSON.stringify(withRequestIdBody(event, { error: 'Missing Spotify credentials.' })),
      }
    }

    const cookies = parseCookies(event.headers?.cookie)
    const refreshToken = cookies.spotify_refresh_token
    if (!refreshToken) {
      logWithContext({ event, level: 'warn', message: 'spotify.token.missing_refresh_token' })
      return {
        statusCode: 401,
        headers: withRequestIdHeaders(event),
        body: JSON.stringify(withRequestIdBody(event, { error: 'Not connected to Spotify.' })),
      }
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
      logWithContext({
        event,
        level: 'error',
        message: 'spotify.token.refresh_failed',
        meta: { status: res.status, spotify: data?.error || data || null },
      })
      return {
        statusCode: 401,
        headers: withRequestIdHeaders(event),
        body: JSON.stringify(
          withRequestIdBody(event, { error: 'Failed to refresh Spotify session.', spotify: data?.error || data }),
        ),
      }
    }

    logWithContext({ event, level: 'info', message: 'spotify.token.refreshed' })

    return {
      statusCode: 200,
      headers: withRequestIdHeaders(event),
      body: JSON.stringify(
        withRequestIdBody(event, { access_token: data.access_token, expires_in: data.expires_in }),
      ),
    }
  } catch (e) {
    logWithContext({ event, level: 'error', message: 'spotify.token.unhandled_error', meta: { error: e?.message || String(e) } })
    return {
      statusCode: 500,
      headers: withRequestIdHeaders(event),
      body: JSON.stringify(withRequestIdBody(event, { error: 'Unexpected error.' })),
    }
  }
}
