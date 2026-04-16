import { CITIES } from '../utils/cities.js'

export default function CitySelector({ value, onChange }) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-zinc-200">City</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl bg-zinc-950/40 px-3 text-sm text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-600"
      >
        {CITIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  )
}
