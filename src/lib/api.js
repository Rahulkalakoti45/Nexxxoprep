const DEFAULT_BASE_URL = 'http://localhost:4000'
const DEFAULT_RETRIES = 2
const RETRY_DELAY_MS = 400

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
}

export function getApiKey() {
  return import.meta.env.VITE_API_KEY || ''
}

export class ApiError extends Error {
  constructor(message, { status, code, details, correlationId } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.correlationId = correlationId
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetry(status) {
  return status === 408 || status === 429 || (status >= 500 && status < 600)
}

async function parseResponse(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    retries = DEFAULT_RETRIES,
    signal,
  } = options

  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const apiKey = getApiKey()

  const requestHeaders = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
    ...headers,
  }

  let attempt = 0
  let lastError

  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      })

      const data = await parseResponse(response)

      if (!response.ok) {
        const errPayload = data?.error || data
        const apiError = new ApiError(errPayload?.message || `Request failed (${response.status})`, {
          status: response.status,
          code: errPayload?.code,
          details: errPayload?.details,
          correlationId: errPayload?.correlationId || data?.correlationId,
        })
        if (attempt < retries && shouldRetry(response.status)) {
          attempt += 1
          await sleep(RETRY_DELAY_MS * attempt)
          continue
        }
        throw apiError
      }

      return data
    } catch (error) {
      lastError = error
      if (error instanceof ApiError || error.name === 'AbortError') throw error
      if (attempt < retries) {
        attempt += 1
        await sleep(RETRY_DELAY_MS * attempt)
        continue
      }
      throw error
    }
  }

  throw lastError
}

export const api = {
  get: (path, options) => apiRequest(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiRequest(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => apiRequest(path, { ...options, method: 'PATCH', body }),
}
