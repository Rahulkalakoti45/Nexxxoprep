import { api } from '../../lib/api.js'

export async function checkHealth() {
  return api.get('/health')
}

export async function checkReady() {
  return api.get('/ready')
}
