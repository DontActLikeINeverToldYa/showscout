import ConcertCard from './ConcertCard.jsx'

export default function ConcertList({ results }) {
  if (!results || results.length === 0) return null

  return (
    <div className="rounded-2xl bg-zinc-900/40 ring-1 ring-zinc-800">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm text-zinc-300">
        {results.length} concerts
      </div>
      <div className="divide-y divide-zinc-800">
        {results.map((r) => (
          <ConcertCard key={`${r.artistName}|${r.startDate}|${r.venue}|${r.city}`} concert={r} />
        ))}
      </div>
    </div>
  )
}
