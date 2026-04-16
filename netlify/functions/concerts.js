function foldDiacritics(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function stripSimpleSuffixes(value) {
  return value.replace(/\s*[\[(].{1,20}[\])]\s*$/u, '').trim()
}

function normalizeArtistName(value) {
  let v = (value || '').trim().toLowerCase()
  v = v.replace(/\s+/g, ' ')
  v = v.replace(/&/g, ' and ')
  v = v.replace(/\s+/g, ' ').trim()
  v = foldDiacritics(v)

  if (v.startsWith('the ')) v = v.slice(4)

  v = stripSimpleSuffixes(v)
  v = v.replace(/\s+/g, ' ').trim()
  return v
}

function attractionMatchesArtist({ attractionName, artistName }) {
  const b = normalizeArtistName(artistName)
  if (!b) return false

  const raw = String(attractionName || '')
  const candidates = raw
    .split(/\s*(?:\+|,|\/|&|\band\b|\bfeat\.?\b|\bft\.?\b|\bwith\b)\s*/iu)
    .map((x) => x.trim())
    .filter(Boolean)

  if (candidates.length === 0) candidates.push(raw)

  for (const c of candidates) {
    const a = normalizeArtistName(c)
    if (a && a === b) return true
  }

  return false
}

function mapProduct(product) {
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

export async function handler(event) {
  try {
    const artist = event.queryStringParameters?.artist
    const city = event.queryStringParameters?.city

    if (!artist || !city) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing artist or city.' }),
      }
    }

    const base = 'https://public-api.eventim.com/websearch/search/api/exploration/v1/products'
    const params = new URLSearchParams({
      webId: 'web__eventim-de',
      language: 'de',
      retail_partner: 'EVE',
      search_term: artist,
      city_names: city,
      sort: 'DateAsc',
      top: '10',
    })

    const url = `${base}?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        // Eventim sometimes blocks serverless IPs unless the request looks browser-like.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        Referer: 'https://www.eventim.de/',
        Origin: 'https://www.eventim.de',
      },
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: `Eventim API error (${res.status}).`,
          eventim: data || null,
        }),
      }
    }

    const products = Array.isArray(data?.products) ? data.products : []

    const matches = []
    for (const p of products) {
      const attractions = Array.isArray(p?.attractions) ? p.attractions : []
      const isMatch = attractions.some((a) => attractionMatchesArtist({ attractionName: a?.name, artistName: artist }))
      if (!isMatch) continue
      matches.push(mapProduct(p))
    }

    // Deduplicate conservatively by productId if present, otherwise by (startDate+venue+city+link)
    const seen = new Set()
    const concerts = []
    for (const m of matches) {
      const key = m.productId
        ? `id:${m.productId}`
        : `k:${m.startDate}|${m.venue}|${m.city}|${m.link}`
      if (seen.has(key)) continue
      seen.add(key)
      concerts.push(m)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ concerts }),
    }
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected error.' }) }
  }
}
