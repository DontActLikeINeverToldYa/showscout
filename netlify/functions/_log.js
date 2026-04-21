function levelRank(level) {
  switch (String(level || '').toLowerCase()) {
    case 'debug':
      return 10
    case 'info':
      return 20
    case 'warn':
      return 30
    case 'error':
      return 40
    default:
      return 20
  }
}

export function getRequestId(event) {
  const h = event?.headers || {}
  return (
    h['x-nf-request-id'] ||
    h['x-request-id'] ||
    h['x-amzn-trace-id'] ||
    h['x-correlation-id'] ||
    null
  )
}

export function shouldLog(level) {
  const configured = process.env.LOG_LEVEL || process.env.DEBUG
  if (!configured) return levelRank(level) >= levelRank('info')
  return levelRank(level) >= levelRank(configured)
}

export function logWithContext({ event, level, message, meta }) {
  if (!shouldLog(level) && level !== 'error') return

  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    requestId: getRequestId(event),
    meta: meta || undefined,
  }

  const fn = console?.[level] || console?.log
  fn(JSON.stringify(entry))
}
