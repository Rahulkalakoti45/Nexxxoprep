import { z } from 'zod'
import { getDotenvLoadReport, loadProjectDotenv } from './env-path.js'

const dotenvReport = loadProjectDotenv()
console.log('[GEMINI_ENV_FORENSICS]', {
  processCwd: dotenvReport.resolution.processCwd,
  resolvedDotenvPath: dotenvReport.resolution.resolvedEnvPath,
  resolvedDotenvExists: dotenvReport.resolution.resolvedEnvExists,
  candidatesChecked: dotenvReport.resolution.candidatesChecked,
  dotenvLoaded: dotenvReport.dotenvLoaded,
  dotenvError: dotenvReport.dotenvError,
  parsedKeyCount: dotenvReport.parsedKeyCount,
  geminiPrefixBeforeLoad: dotenvReport.processEnvGeminiPrefixBeforeLoad,
  geminiPrefixAfterLoad: dotenvReport.geminiKeyPrefixAfterLoad,
  geminiLoadedFromDotenv: dotenvReport.geminiKeyLoadedFromDotenv,
})

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVER_HOST: z.string().default('0.0.0.0'),
  SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  JWT_ISSUER: z.string().default('nexoprep'),
  JWT_AUDIENCE: z.string().default('nexoprep-api'),
  API_KEY_DEV_ONLY: z.string().min(8),
  SESSION_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  TRANSCRIPT_BUFFER_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  EVENT_STREAM_MAXLEN: z.coerce.number().int().positive().default(10000),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_AGENT_ID: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  CUSTOM_LLM_SECRET: z.string().optional(),
  CONVERSATION_MEMORY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  CONVERSATION_LOCAL_LOG_DIR: z.string().default('local_sessions'),
  BEHAVIOR_ENGINE_ENABLED: z.coerce.boolean().default(true),
  BEHAVIOR_ENGINE_DIR: z.string().default('behavior-engine'),
  BEHAVIOR_ENGINE_ENTRYPOINT: z.string().default('main.py'),
  BEHAVIOR_ENGINE_PYTHON_BIN: z.string().optional(),
  BEHAVIOR_ENGINE_STOP_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
})

export type AppConfig = z.infer<typeof envSchema> & {
  corsOrigins: string[]
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  // Render (and most PaaS hosts) assign the listen port via `PORT` and expect
  // the process to bind to it; this app's own config key is `SERVER_PORT`.
  // Fall back to `PORT` only when `SERVER_PORT` wasn't explicitly set, so
  // local dev (which sets SERVER_PORT=4000 in .env) is unaffected.
  const resolvedSource = source.SERVER_PORT ? source : { ...source, SERVER_PORT: source.PORT ?? source.SERVER_PORT }
  const parsed = envSchema.safeParse(resolvedSource)
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Invalid backend environment: ${message}`)
  }

  return {
    ...parsed.data,
    corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  }
}
