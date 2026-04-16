function buildRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let text = ''
  for (let i = 0; i < length; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

export async function handler() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI
  const appBaseUrl = process.env.APP_BASE_URL

  if (!clientId || !redirectUri || !appBaseUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing Spotify OAuth configuration.' }),
    }
  }

  const state = buildRandomString(24)
  const scope = [
    'playlist-read-private',
    'playlist-read-collaborative',
  ].join(' ')

  const authUrl = new URL('https://accounts.spotify.com/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('show_dialog', 'false')

  const cookieParts = [
    `spotify_auth_state=${encodeURIComponent(state)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
  ]
  if (String(redirectUri).startsWith('https://')) cookieParts.push('Secure')
  const cookie = cookieParts.join('; ')

  return {
    statusCode: 302,
    headers: {
      Location: authUrl.toString(),
      'Set-Cookie': cookie,
      'Cache-Control': 'no-store',
    },
    body: '',
  }
}
