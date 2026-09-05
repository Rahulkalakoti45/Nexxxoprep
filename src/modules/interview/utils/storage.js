import { validateSessionShape } from './validators'

const STORAGE_KEY = 'nexoprep_interview_v2'

export function saveInterviewSessionV2(session) {
  try {
    if (!validateSessionShape(session)) return false
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    return true
  } catch (_e) {
    return false
  }
}

export function loadInterviewSessionV2() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!validateSessionShape(parsed)) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch (_e) {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearInterviewSessionV2() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (_e) {
    // no-op
  }
}

export { STORAGE_KEY }

