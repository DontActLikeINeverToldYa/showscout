import { useState } from 'react'
import { buildShareUrl } from '../utils/url.js'

export default function ShareButton({ disabled, playlistId, city }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    const url = buildShareUrl({ playlistId, city })
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onCopy}
      className="h-9 rounded-xl bg-zinc-950/40 px-3 text-xs text-zinc-200 ring-1 ring-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      title={disabled ? 'Load a playlist first' : 'Copy share link'}
    >
      {copied ? 'Copied' : 'Copy Link'}
    </button>
  )
}
