function foldDiacritics(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function stripSimpleSuffixes(value) {
  // Strip a single trailing parenthetical/bracket suffix, conservatively.
  return value.replace(/\s*[\[(].{1,20}[\])]\s*$/u, '').trim()
}

function normalizeArtistName(value) {
  let v = (value || '').trim().toLowerCase()
  v = v.replace(/\s+/g, ' ')
  v = v.replace(/&/g, ' and ')
  v = v.replace(/\s+/g, ' ').trim()
  v = foldDiacritics(v)

  // Optional leading article.
  if (v.startsWith('the ')) v = v.slice(4)

  v = stripSimpleSuffixes(v)
  v = v.replace(/\s+/g, ' ').trim()
  return v
}

export function attractionMatchesArtist({ attractionName, artistName }) {
  const a = normalizeArtistName(attractionName)
  const b = normalizeArtistName(artistName)
  return a.length > 0 && a === b
}

export function mapEventimProductToConcert(product) {
  const live = product?.typeAttributes?.liveEntertainment
  const location = live?.location
  return {
    productId: product?.productId ?? null,
    eventName: product?.name ?? '',
    status: product?.status ?? '',
    link: product?.link ?? '',
    price: typeof product?.price === 'number' ? product.price : null,
    currency: product?.currency ?? null,
    startDate: live?.startDate ?? null,
    venue: location?.name ?? '',
    city: location?.city ?? '',
    attractions: Array.isArray(product?.attractions) ? product.attractions.map((x) => x?.name).filter(Boolean) : [],
  }
}

export function dedupeConcerts(concerts) {
  const seen = new Set()
  const out = []

  for (const c of concerts) {
    const key = [c.artistName, c.startDate, c.venue, c.city].map((x) => String(x ?? '')).join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }

  return out
}
