import { validateSessionShape } from './validators'

const STORAGE_KEY = 'nexoprep_interview_v2'

export function saveSession(session) {
  try {
    if (!validateSessionShape(session)) return false
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    return true
  } catch (_error) {
    return false
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!validateSessionShape(parsed)) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch (_error) {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (_error) {
    // No-op by design.
  }
}

export { STORAGE_KEY }
