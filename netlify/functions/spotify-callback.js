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
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI
    const appBaseUrl = process.env.APP_BASE_URL

    if (!clientId || !clientSecret || !redirectUri || !appBaseUrl) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing Spotify OAuth configuration.' }),
      }
    }

    const code = event.queryStringParameters?.code
    const state = event.queryStringParameters?.state

    const cookies = parseCookies(event.headers?.cookie)
    const expectedState = cookies.spotify_auth_state

    if (!code) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing code.' }) }
    }

    if (!state || !expectedState || state !== expectedState) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid OAuth state.' }) }
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.refresh_token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Failed to complete Spotify login.', spotify: data }),
      }
    }

    const refreshCookieParts = [
      `spotify_refresh_token=${encodeURIComponent(data.refresh_token)}`,
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
    ]
    if (String(appBaseUrl).startsWith('https://')) refreshCookieParts.push('Secure')
    const refreshCookie = refreshCookieParts.join('; ')

    const clearStateCookie = [
      'spotify_auth_state=deleted',
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
      'Max-Age=0',
    ].join('; ')

    const redirect = new URL(appBaseUrl)
    redirect.searchParams.set('connected', '1')

    return {
      statusCode: 302,
      headers: {
        Location: redirect.toString(),
        'Cache-Control': 'no-store',
      },
      multiValueHeaders: {
        'Set-Cookie': [refreshCookie, clearStateCookie],
      },
      body: '',
    }
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected error.' }) }
  }
}
