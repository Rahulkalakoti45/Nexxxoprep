/** A live coding round (not the problem list or a result page). */
export function isCodingSession(pathname) {
  return /^\/coding\/(?!result\/)[^/]+$/.test(pathname)
}
