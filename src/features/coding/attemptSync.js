import { getCodingAttempt, listCodingAttempts, replaceCodingAttempts, saveCodingAttempt } from './interviewer.js'
import { getCodingAttemptRemote, listCodingAttemptsRemote, saveCodingAttemptRemote } from '../../services/backend/codingApi.js'

const MAX_KEPT = 30

/**
 * Combines attempts saved on this device with those on the server, one per id. The server copy
 * wins (it may come from another device), but a device copy that was never uploaded is kept.
 */
export function mergeAttempts(local = [], remote = []) {
  const byId = new Map()
  for (const a of local) byId.set(a.id, a)
  for (const a of remote) byId.set(a.id, { ...byId.get(a.id), ...a })
  return [...byId.values()].sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt))).slice(0, MAX_KEPT)
}

/** Attempts finished on this device that the server doesn't have yet. */
export function pendingUploads(local = []) {
  return local.filter((a) => !a.syncedAt)
}

async function upload(userId, attempt) {
  const saved = await saveCodingAttemptRemote(userId, attempt)
  saveCodingAttempt({ ...attempt, syncedAt: saved.syncedAt })
  return saved
}

/**
 * Keeps a finished attempt: on this device straight away, then on the server. A failed upload
 * is retried the next time the coding pages load.
 */
export async function persistAttempt(userId, attempt) {
  saveCodingAttempt(attempt)
  if (!userId) return { synced: false }
  try {
    await upload(userId, attempt)
    return { synced: true }
  } catch {
    return { synced: false }
  }
}

/**
 * Uploads anything left on the device, then returns the merged history. Works offline: without
 * the server it returns what this device has.
 */
export async function loadAttempts(userId) {
  const local = listCodingAttempts()
  if (!userId) return { attempts: local, online: false }
  for (const attempt of pendingUploads(local).slice(0, 10)) {
    try {
      await upload(userId, attempt)
    } catch {
      break // Server unreachable: try again next time.
    }
  }
  try {
    const remote = await listCodingAttemptsRemote(userId)
    const merged = mergeAttempts(listCodingAttempts(), remote)
    replaceCodingAttempts(merged)
    return { attempts: merged, online: true }
  } catch {
    return { attempts: listCodingAttempts(), online: false }
  }
}

/** One attempt: from this device if it's here, otherwise from the server (and then kept here). */
export async function loadAttempt(userId, attemptId) {
  const local = getCodingAttempt(attemptId)
  if (local || !userId) return local
  try {
    const remote = await getCodingAttemptRemote(userId, attemptId)
    saveCodingAttempt(remote)
    return remote
  } catch {
    return null
  }
}
