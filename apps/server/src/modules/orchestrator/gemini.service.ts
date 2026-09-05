import type { AppConfig } from '@nexoprep/config'
import { AppError } from '@nexoprep/shared'
import {
  buildGeminiBootLog,
  buildGeminiFinalDiagnosis,
  buildGeminiGenerateUrl,
  buildGeminiStreamUrl,
  collectGeminiEnvSources,
  redactGeminiUrl,
  validateGeminiApiKey,
} from './gemini-env.js'

export interface GeminiMessage {
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      status: error.statusCode,
      code: error.code,
      response: error.details ?? null,
      cause: error.cause ?? null,
    }
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      cause: error.cause ?? null,
    }
  }
  return { raw: error }
}

function summarizeContents(messages: GeminiMessage[]) {
  return messages.map((message, index) => ({
    index,
    role: message.role,
    textLength: message.parts.map((part) => part.text.length).reduce((a, b) => a + b, 0),
    textPreview: message.parts.map((part) => part.text).join('').slice(0, 120),
  }))
}

export class GeminiService {
  private booted = false

  constructor(private readonly config: AppConfig) {}

  runBootDiagnostics(): void {
    if (this.booted) return
    this.booted = true

    console.log('[GEMINI_BOOT]', buildGeminiBootLog(this.config))

    const sources = collectGeminiEnvSources(this.config)
    console.log('[GEMINI_BOOT]', { envSources: sources })

    try {
      validateGeminiApiKey(this.config.GEMINI_API_KEY)
    } catch (error) {
      const diagnosis = buildGeminiFinalDiagnosis(this.config, sources)
      console.log('[GEMINI_FINAL_DIAGNOSIS]', diagnosis)
      throw error
    }

    const diagnosis = buildGeminiFinalDiagnosis(this.config, sources)
    console.log('[GEMINI_FINAL_DIAGNOSIS]', {
      ...diagnosis,
      actualKeySource: sources.actualKeySource,
      expectedKeySource: 'dotenv_file',
      expectedKeyPrefix: sources.dotEnvFile.prefix,
      expectedKeySuffix: sources.dotEnvFile.suffix,
      actualKeyPrefix: sources.config.prefix,
      actualKeySuffix: sources.config.suffix,
      processCwd: sources.processCwd,
      resolvedDotenvPath: sources.dotEnvFile.resolvedEnvPath,
      dotenvLoaded: sources.dotenvLoadReport?.dotenvLoaded ?? false,
      whyCurlSucceedsButBackendFails:
        sources.actualKeySource !== 'dotenv_file'
          ? 'curl uses the valid key copied from .env manually; backend inherited a different GEMINI_API_KEY because .env was not loaded from apps/server cwd.'
          : null,
    })

    if (sources.dotEnvOverridesBlocked) {
      console.warn('[GEMINI_BOOT]', {
        warning:
          'process.env.GEMINI_API_KEY differed from .env before override; ensure loadDotEnv({ override: true }) is active.',
      })
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config.GEMINI_API_KEY)
  }

  async runConnectivityTest(): Promise<Record<string, unknown>> {
    this.runBootDiagnostics()
    const apiKey = this.config.GEMINI_API_KEY
    if (!apiKey) {
      return { ok: false, error: 'GEMINI_API_KEY missing' }
    }

    const url = buildGeminiStreamUrl(this.config.GEMINI_MODEL, apiKey)
    console.log('[GEMINI_REQUEST_URL]', redactGeminiUrl(url))

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: ok' }] }],
        generationConfig: { maxOutputTokens: 16 },
      }),
    })

    const body = await response.text()
    const sources = collectGeminiEnvSources(this.config)
    let googleReason: string | undefined
    try {
      const parsed = JSON.parse(body) as { error?: { details?: Array<{ reason?: string }>; message?: string } }
      googleReason = parsed.error?.details?.[0]?.reason ?? parsed.error?.message
    } catch {
      googleReason = undefined
    }

    const diagnosis = buildGeminiFinalDiagnosis(this.config, sources, {
      googleStatus: response.status,
      ...(googleReason ? { googleReason } : {}),
    })
    console.log('[GEMINI_FINAL_DIAGNOSIS]', diagnosis)

    return {
      ok: response.ok,
      status: response.status,
      diagnosis,
      body: body.slice(0, 2000),
      url: redactGeminiUrl(url),
    }
  }

  async *streamGenerate(systemPrompt: string, messages: GeminiMessage[]): AsyncGenerator<string> {
    if (!this.isConfigured()) {
      throw new AppError('Gemini is not configured', { code: 'SERVICE_UNAVAILABLE', statusCode: 503 })
    }

    const model = this.config.GEMINI_MODEL
    const url = buildGeminiStreamUrl(model, this.config.GEMINI_API_KEY!)
    console.log('[GEMINI_REQUEST_URL]', redactGeminiUrl(url))

    const contents = messages.map((m) => ({
      role: m.role,
      parts: m.parts,
    }))

    const requestBody = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
      },
    }

    console.log('[GEMINI_REQUEST_START]', {
      model,
      mode: 'stream',
      systemPromptLength: systemPrompt.length,
      messageCount: messages.length,
      lastRole: messages[messages.length - 1]?.role ?? null,
    })
    console.log('[GEMINI_REQUEST_PAYLOAD]', {
      model,
      systemPromptPreview: systemPrompt.slice(0, 400),
      contentsSummary: summarizeContents(messages),
      generationConfig: requestBody.generationConfig,
    })

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
    } catch (error) {
      console.log('[GEMINI_ERROR_FULL]', serializeError(error))
      throw error
    }

    if (!response.ok) {
      const text = await response.text()
      console.log('[GEMINI_RAW_RESPONSE]', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body: text,
      })
      const appError = new AppError('Gemini request failed', {
        code: 'UPSTREAM_ERROR',
        statusCode: 502,
        details: { status: response.status, body: text },
      })
      console.log('[GEMINI_ERROR_FULL]', serializeError(appError))
      throw appError
    }

    const reader = response.body?.getReader()
    if (!reader) {
      const appError = new AppError('Gemini stream unavailable', { code: 'UPSTREAM_ERROR', statusCode: 502 })
      console.log('[GEMINI_ERROR_FULL]', serializeError(appError))
      throw appError
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let chunkCount = 0
    let emittedChars = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (!payload || payload === '[DONE]') continue
          chunkCount += 1
          if (chunkCount <= 3) {
            console.log('[GEMINI_RAW_RESPONSE]', { chunk: chunkCount, payloadPreview: payload.slice(0, 500) })
          }
          try {
            const json = JSON.parse(payload) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
              error?: { message?: string; code?: number; status?: string }
            }
            if (json.error) {
              console.log('[GEMINI_RAW_RESPONSE]', { streamError: json.error })
            }
            const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
            if (text) {
              emittedChars += text.length
              yield text
            }
          } catch (parseError) {
            console.log('[GEMINI_RAW_RESPONSE]', {
              chunk: chunkCount,
              parseError: parseError instanceof Error ? parseError.message : String(parseError),
              payloadPreview: payload.slice(0, 300),
            })
          }
        }
      }
      console.log('[GEMINI_RAW_RESPONSE]', {
        streamComplete: true,
        chunkCount,
        emittedChars,
      })
    } catch (error) {
      console.log('[GEMINI_ERROR_FULL]', serializeError(error))
      throw error
    }
  }

  async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new AppError('Gemini is not configured', { code: 'SERVICE_UNAVAILABLE', statusCode: 503 })
    }

    const model = this.config.GEMINI_MODEL
    const url = buildGeminiGenerateUrl(model, this.config.GEMINI_API_KEY!)
    console.log('[GEMINI_REQUEST_URL]', redactGeminiUrl(url))

    const requestBody = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    }

    console.log('[GEMINI_REQUEST_START]', {
      model,
      mode: 'buffered',
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
    })
    console.log('[GEMINI_REQUEST_PAYLOAD]', {
      model,
      systemPromptPreview: systemPrompt.slice(0, 400),
      userPromptPreview: userPrompt.slice(0, 400),
      generationConfig: requestBody.generationConfig,
    })

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
    } catch (error) {
      console.log('[GEMINI_ERROR_FULL]', serializeError(error))
      throw error
    }

    if (!response.ok) {
      const text = await response.text()
      console.log('[GEMINI_RAW_RESPONSE]', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body: text,
      })
      const appError = new AppError('Gemini request failed', {
        code: 'UPSTREAM_ERROR',
        statusCode: 502,
        details: { status: response.status, body: text },
      })
      console.log('[GEMINI_ERROR_FULL]', serializeError(appError))
      throw appError
    }

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      error?: { message?: string; code?: number; status?: string }
    }
    console.log('[GEMINI_RAW_RESPONSE]', {
      ok: true,
      status: response.status,
      hasCandidates: Boolean(json.candidates?.length),
      error: json.error ?? null,
      preview: JSON.stringify(json).slice(0, 800),
    })
    return json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
  }
}
