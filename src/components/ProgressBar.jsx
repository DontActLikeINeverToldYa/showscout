export default function ProgressBar({ state, current, total, concertsFound }) {
  if (total === 0) return null

  const pct = Math.min(100, Math.round((current / total) * 100))

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <div>
          Checking artist {current} of {total}…
        </div>
        <div>{concertsFound} concerts found</div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full bg-zinc-200" style={{ width: `${pct}%` }} />
      </div>
      {state === 'done' && (
        <div className="text-xs text-zinc-500">Done.</div>
      )}
    </div>
  )
}
