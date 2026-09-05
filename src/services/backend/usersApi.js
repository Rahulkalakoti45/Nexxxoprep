import { api } from '../../lib/api.js'

export async function createOrUpdateUser(payload) {
  const { user } = await api.post('/api/users', payload)
  return user
}

export async function getUserHistory(userId, { limit = 25 } = {}) {
  const { sessions } = await api.get(`/api/users/${encodeURIComponent(userId)}/history?limit=${limit}`)
  return sessions
}
