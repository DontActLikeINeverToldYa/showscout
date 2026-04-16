function formatGermanDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(d).replace('.', '')
  const day = new Intl.DateTimeFormat('de-DE', { day: '2-digit' }).format(d)
  const month = new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(d).replace('.', '')
  const year = new Intl.DateTimeFormat('de-DE', { year: 'numeric' }).format(d)

  return `${weekday}, ${day}. ${month} ${year}`
}

function formatPrice(price, currency) {
  if (typeof price !== 'number') return null
  if (currency !== 'EUR' && currency) return `ab ${price.toFixed(2)} ${currency}`
  const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price)
  return `ab ${formatted}`
}

function statusBadge(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('sold')) {
    return { label: 'Sold out', cls: 'bg-zinc-800 text-zinc-200 ring-zinc-700' }
  }
  if (s.includes('available')) {
    return { label: 'Available', cls: 'bg-emerald-950/40 text-emerald-200 ring-emerald-900' }
  }
  return { label: status || 'Unknown', cls: 'bg-zinc-900 text-zinc-300 ring-zinc-800' }
}

export default function ConcertCard({ concert }) {
  const date = formatGermanDate(concert.startDate)
  const price = formatPrice(concert.price, concert.currency)
  const badge = statusBadge(concert.status)

  return (
    <div className="grid gap-2 px-4 py-4 md:grid-cols-[160px_1fr_auto] md:items-center">
      <div className="text-sm text-zinc-200">{date}</div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="truncate text-sm font-medium text-zinc-100">
            {concert.artistName}
          </div>
          <div className="text-xs text-zinc-400">· {concert.trackCount} tracks</div>
          <div className={`rounded-full px-2 py-0.5 text-xs ring-1 ${badge.cls}`}>{badge.label}</div>
        </div>

        <div className="mt-1 grid gap-0.5 text-xs text-zinc-400">
          {concert.eventName && <div className="truncate">{concert.eventName}</div>}
          <div className="truncate">
            {concert.venue}, {concert.city}
          </div>
          {price && <div>{price}</div>}
        </div>
      </div>

      <div className="mt-2 md:mt-0">
        <a
          href={concert.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-100 px-3 text-sm font-medium text-zinc-950"
        >
          Tickets
        </a>
      </div>
    </div>
  )
}
