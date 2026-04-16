export function getSearchParams(search) {
  const params = new URLSearchParams(search)
  const playlist = params.get('playlist') || undefined
  const city = params.get('city') || undefined
  return { playlist, city }
}

export function setSearchParams({ playlist, city }) {
  const params = new URLSearchParams(window.location.search)

  if (playlist) params.set('playlist', playlist)
  else params.delete('playlist')

  if (city) params.set('city', city)
  else params.delete('city')

  const next = `${window.location.pathname}?${params.toString()}`
  window.history.replaceState({}, '', next)
}

export function buildShareUrl({ playlistId, city }) {
  const params = new URLSearchParams()
  params.set('playlist', playlistId)
  params.set('city', city)
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`
}
