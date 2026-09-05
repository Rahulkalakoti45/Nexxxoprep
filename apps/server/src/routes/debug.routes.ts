import type { FastifyInstance } from 'fastify'
import {
  buildGeminiFinalDiagnosis,
  buildGeminiModelsListUrl,
  buildGeminiStreamUrl,
  collectGeminiEnvSources,
  redactGeminiUrl,
} from '../modules/orchestrator/gemini-env.js'

export async function registerDebugRoutes(server: FastifyInstance): Promise<void> {
  server.get('/gemini-test', async () => {
    const config = server.config
    const sources = collectGeminiEnvSources(config)
    const apiKey = config.GEMINI_API_KEY

    if (!apiKey) {
      const diagnosis = buildGeminiFinalDiagnosis(config, sources)
      console.log('[GEMINI_FINAL_DIAGNOSIS]', diagnosis)
      return {
        ok: false,
        diagnosis,
        envSources: sources,
        tests: [],
      }
    }

    const listUrl = buildGeminiModelsListUrl(apiKey)
    const streamUrl = buildGeminiStreamUrl(config.GEMINI_MODEL, apiKey)

    console.log('[GEMINI_REQUEST_URL]', redactGeminiUrl(listUrl))

    const listResponse = await fetch(listUrl)
    const listBody = await listResponse.text()

    let streamStatus: number | null = null
    let streamBody = ''
    if (listResponse.ok) {
      console.log('[GEMINI_REQUEST_URL]', redactGeminiUrl(streamUrl))
      const streamResponse = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: ok' }] }],
          generationConfig: { maxOutputTokens: 16 },
        }),
      })
      streamStatus = streamResponse.status
      streamBody = await streamResponse.text()
    }

    let googleReason: string | undefined
    try {
      const parsed = JSON.parse(listBody) as { error?: { message?: string; details?: Array<{ reason?: string }> } }
      googleReason = parsed.error?.details?.[0]?.reason ?? parsed.error?.message
    } catch {
      googleReason = undefined
    }

    const diagnosis = buildGeminiFinalDiagnosis(config, sources, {
      googleStatus: listResponse.status,
      ...(googleReason ? { googleReason } : {}),
    })

    console.log('[GEMINI_FINAL_DIAGNOSIS]', diagnosis)

    return {
      ok: listResponse.ok && (streamStatus === null || streamStatus < 400),
      diagnosis,
      envSources: sources,
      tests: [
        {
          name: 'models_list',
          method: 'GET',
          url: redactGeminiUrl(listUrl),
          status: listResponse.status,
          body: listBody.slice(0, 2000),
        },
        {
          name: 'stream_generate_minimal',
          method: 'POST',
          url: redactGeminiUrl(streamUrl),
          status: streamStatus,
          body: streamBody.slice(0, 2000),
        },
      ],
    }
  })
}
