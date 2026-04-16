import { useCallback, useRef, useState } from 'react'
import { attractionMatchesArtist, mapEventimProductToConcert } from '../utils/eventim.js'

const THROTTLE_MS = 200

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function useConcertSearch() {
  const [state, setState] = useState('idle')
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState([])

  const cancelRef = useRef({ cancelled: false })

  const reset = useCallback(() => {
    cancelRef.current.cancelled = false
    setState('idle')
    setError(null)
    setProgress({ current: 0, total: 0 })
    setResults([])
  }, [])

  const startSearch = useCallback(async ({ artists, city }) => {
    cancelRef.current.cancelled = false
    setError(null)
    setResults([])
    setProgress({ current: 0, total: artists.length })
    setState('running')

    const seen = new Set()

    for (let i = 0; i < artists.length; i += 1) {
      if (cancelRef.current.cancelled) break

      const artist = artists[i]
      setProgress({ current: i + 1, total: artists.length })

      try {
        let concerts = null

        try {
          const base =
            'https://public-api.eventim.com/websearch/search/api/exploration/v1/products'
          const qs = new URLSearchParams({
            webId: 'web__eventim-de',
            language: 'de',
            retail_partner: 'EVE',
            search_term: artist.name,
            city_names: city,
            sort: 'DateAsc',
            top: '10',
          })
          const res = await fetch(`${base}?${qs.toString()}`)
          const data = await res.json().catch(() => ({}))
          const products = Array.isArray(data?.products) ? data.products : []
          const matched = []
          for (const p of products) {
            const attractions = Array.isArray(p?.attractions) ? p.attractions : []
            const isMatch = attractions.some((a) =>
              attractionMatchesArtist({ attractionName: a?.name, artistName: artist.name }),
            )
            if (!isMatch) continue
            matched.push(mapEventimProductToConcert(p))
          }
          concerts = matched
        } catch {
          concerts = null
        }

        if (!concerts) {
          const qs = new URLSearchParams({ artist: artist.name, city })
          const res = await fetch(`/.netlify/functions/concerts?${qs.toString()}`)
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            if (!error) {
              setError(data?.error ? String(data.error) : `Concert lookup failed (${res.status}).`)
            }
          } else if (Array.isArray(data.concerts)) {
            concerts = data.concerts
          } else {
            concerts = []
          }
        }

        if (Array.isArray(concerts)) {
          const mapped = concerts.map((c) => ({
            ...c,
            artistId: artist.id,
            artistName: artist.name,
            trackCount: artist.trackCount,
          }))

          setResults((prev) => {
            const next = [...prev]
            for (const c of mapped) {
              const key = [c.artistName, c.startDate, c.venue, c.city].join('|')
              if (seen.has(key)) continue
              seen.add(key)
              next.push(c)
            }
            next.sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
            return next
          })
        }
      } catch {
        if (!error) setError('Concert lookup failed.')
      }

      await sleep(THROTTLE_MS)
    }

    setState('done')
  }, [])

  const cancel = useCallback(() => {
    cancelRef.current.cancelled = true
    setState('idle')
  }, [])

  return { state, error, progress, results, startSearch, reset, cancel }
}
