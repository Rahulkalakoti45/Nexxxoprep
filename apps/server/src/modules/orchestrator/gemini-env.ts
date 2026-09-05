import type { AppConfig } from '@nexoprep/config'
import {
  getDotenvLoadReport,
  readGeminiKeyFromResolvedEnvFile,
  resolveProjectEnvPath,
} from '@nexoprep/config'

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const EXPECTED_GEMINI_MODEL = 'gemini-2.5-flash'

export type GeminiKeyInspection = {
  present: boolean
  length: number | null
  prefix: string | null
  suffix: string | null
  hasQuotes: boolean
  hasWhitespace: boolean
}

export type GeminiEnvSources = {
  processEnv: GeminiKeyInspection
  config: GeminiKeyInspection
  dotEnvFile: GeminiKeyInspection & {
    rawPresent: boolean
    matchesConfig: boolean | null
    resolvedEnvPath: string | null
  }
  processEnvMatchesConfig: boolean
  dotEnvMatchesConfig: boolean | null
  dotEnvOverridesBlocked: boolean
  actualKeySource:
    | 'dotenv_file'
    | 'windows_user_env'
    | 'process_env'
    | 'missing'
    | 'unknown'
  processCwd: string
  dotenvLoadReport: ReturnType<typeof getDotenvLoadReport>
}

export type GeminiFinalDiagnosis = {
  loadedKeyPrefix: string | null
  loadedKeySuffix: string | null
  loadedModel: string
  expectedModel: string
  modelMatches: boolean
  finalUrlTemplate: string
  keyParamCount: number
  endpoint: string
  reason: string
  category:
    | 'ok'
    | 'invalid_key'
    | 'wrong_endpoint'
    | 'wrong_model'
    | 'malformed_request'
    | 'env_loading_issue'
}

export function inspectGeminiKey(raw: string | undefined | null): GeminiKeyInspection {
  if (!raw) {
    return {
      present: false,
      length: null,
      prefix: null,
      suffix: null,
      hasQuotes: false,
      hasWhitespace: false,
    }
  }

  return {
    present: raw.length > 0,
    length: raw.length,
    prefix: raw.slice(0, 10),
    suffix: raw.slice(-6),
    hasQuotes: /^["']|["']$/.test(raw) || raw.includes('"') || raw.includes("'"),
    hasWhitespace: /\s/.test(raw),
  }
}

export function validateGeminiApiKey(raw: string | undefined): void {
  if (!raw?.length) {
    throw new Error('GEMINI_API_KEY is missing')
  }
  if (/^["'].*["']$/.test(raw) || raw.includes('"') || raw.includes("'")) {
    throw new Error('GEMINI_API_KEY contains quotes')
  }
  if (/\s/.test(raw)) {
    throw new Error('GEMINI_API_KEY contains whitespace or newlines')
  }
}

export function readGeminiKeyFromDotEnvFile(cwd = process.cwd()): string | null {
  return readGeminiKeyFromResolvedEnvFile(cwd).key
}

function resolveActualKeySource(
  configKey: string | undefined,
  dotEnvKey: string | null,
  dotenvLoaded: boolean,
): GeminiEnvSources['actualKeySource'] {
  if (!configKey) return 'missing'
  if (dotEnvKey && configKey === dotEnvKey && dotenvLoaded) return 'dotenv_file'
  if (dotEnvKey && configKey !== dotEnvKey) return 'process_env'
  if (!dotenvLoaded && configKey) return 'windows_user_env'
  return 'unknown'
}

export function collectGeminiEnvSources(config: AppConfig): GeminiEnvSources {
  const processKey = process.env.GEMINI_API_KEY
  const configKey = config.GEMINI_API_KEY
  const { key: dotEnvKey, envPath } = readGeminiKeyFromResolvedEnvFile()
  const dotenvLoadReport = getDotenvLoadReport()

  const processInspection = inspectGeminiKey(processKey)
  const configInspection = inspectGeminiKey(configKey)
  const dotEnvInspection = inspectGeminiKey(dotEnvKey)

  const dotEnvOverridesBlocked =
    Boolean(processKey && dotEnvKey && processKey !== dotEnvKey && configKey === processKey)

  const actualKeySource = resolveActualKeySource(
    configKey,
    dotEnvKey,
    Boolean(dotenvLoadReport?.dotenvLoaded),
  )

  return {
    processEnv: processInspection,
    config: configInspection,
    dotEnvFile: {
      ...dotEnvInspection,
      rawPresent: dotEnvKey !== null,
      matchesConfig: dotEnvKey && configKey ? dotEnvKey === configKey : null,
      resolvedEnvPath: envPath,
    },
    processEnvMatchesConfig: Boolean(processKey && configKey && processKey === configKey),
    dotEnvMatchesConfig: dotEnvKey && configKey ? dotEnvKey === configKey : null,
    dotEnvOverridesBlocked,
    actualKeySource,
    processCwd: process.cwd(),
    dotenvLoadReport,
  }
}

export function buildGeminiStreamUrl(model: string, apiKey: string): string {
  return `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
}

export function buildGeminiGenerateUrl(model: string, apiKey: string): string {
  return `${GEMINI_API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
}

export function buildGeminiModelsListUrl(apiKey: string): string {
  return `${GEMINI_API_BASE}/models?key=${encodeURIComponent(apiKey)}`
}

export function redactGeminiUrl(url: string): string {
  return url.replace(/([?&]key=)([^&]+)/, '$1[REDACTED]')
}

export function countKeyQueryParams(url: string): number {
  return (url.match(/[?&]key=/g) || []).length
}

export function buildGeminiBootLog(config: AppConfig) {
  const apiKey = config.GEMINI_API_KEY
  const resolution = resolveProjectEnvPath()
  const { key: dotEnvKey, envPath } = readGeminiKeyFromResolvedEnvFile()
  const dotenvLoadReport = getDotenvLoadReport()

  return {
    model: config.GEMINI_MODEL,
    apiKeyPresent: Boolean(apiKey),
    apiKeyLength: apiKey?.length ?? null,
    apiKeyPrefix: apiKey?.slice(0, 10) ?? null,
    apiKeySuffix: apiKey?.slice(-6) ?? null,
    processEnvPrefix: process.env.GEMINI_API_KEY?.slice(0, 10) ?? null,
    processEnvSuffix: process.env.GEMINI_API_KEY?.slice(-6) ?? null,
    dotEnvFilePrefix: dotEnvKey?.slice(0, 10) ?? null,
    dotEnvFileSuffix: dotEnvKey?.slice(-6) ?? null,
    processCwd: process.cwd(),
    resolvedDotenvPath: resolution.resolvedEnvPath,
    resolvedDotenvExists: resolution.resolvedEnvExists,
    dotenvLoaded: dotenvLoadReport?.dotenvLoaded ?? false,
    dotenvParsedKeyCount: dotenvLoadReport?.parsedKeyCount ?? 0,
    geminiPrefixBeforeDotenv: dotenvLoadReport?.processEnvGeminiPrefixBeforeLoad ?? null,
    geminiPrefixAfterDotenv: dotenvLoadReport?.geminiKeyPrefixAfterLoad ?? null,
    dotEnvFilePath: envPath,
  }
}

export function buildGeminiFinalDiagnosis(
  config: AppConfig,
  sources: GeminiEnvSources,
  options?: { googleStatus?: number; googleReason?: string },
): GeminiFinalDiagnosis {
  const apiKey = config.GEMINI_API_KEY ?? ''
  const model = config.GEMINI_MODEL
  const finalUrl = buildGeminiStreamUrl(model, apiKey)

  let category: GeminiFinalDiagnosis['category'] = 'ok'
  let reason = 'Configuration appears valid for Gemini REST streaming.'

  if (!apiKey) {
    category = 'env_loading_issue'
    reason = 'GEMINI_API_KEY is not loaded into AppConfig.'
  } else if (!sources.dotenvLoadReport?.dotenvLoaded && sources.dotEnvFile.rawPresent) {
    category = 'env_loading_issue'
    reason = `dotenv failed to load although .env exists at ${sources.dotEnvFile.resolvedEnvPath}.`
  } else if (!sources.dotenvLoadReport?.dotenvLoaded && sources.actualKeySource === 'windows_user_env') {
    category = 'env_loading_issue'
    reason =
      'No .env was loaded because process.cwd() did not resolve to the monorepo root; Windows user-level GEMINI_API_KEY is being used instead.'
  } else if (sources.actualKeySource === 'windows_user_env' || sources.actualKeySource === 'process_env') {
    category = 'env_loading_issue'
    reason = `Backend is using ${sources.actualKeySource} GEMINI_API_KEY instead of the .env file value.`
  } else if (sources.dotEnvOverridesBlocked) {
    category = 'env_loading_issue'
    reason =
      'process.env.GEMINI_API_KEY differs from .env GEMINI_API_KEY — dotenv did not override a pre-existing shell environment variable.'
  } else if (sources.dotEnvMatchesConfig === false) {
    category = 'env_loading_issue'
    reason = 'AppConfig GEMINI_API_KEY does not match the value in .env.'
  } else if (inspectGeminiKey(apiKey).hasQuotes) {
    category = 'malformed_request'
    reason = 'GEMINI_API_KEY contains quote characters that would corrupt the query string.'
  } else if (inspectGeminiKey(apiKey).hasWhitespace) {
    category = 'malformed_request'
    reason = 'GEMINI_API_KEY contains whitespace or newline characters.'
  } else if (model !== EXPECTED_GEMINI_MODEL) {
    category = 'wrong_model'
    reason = `Configured model "${model}" differs from expected "${EXPECTED_GEMINI_MODEL}".`
  } else if (!finalUrl.startsWith(`${GEMINI_API_BASE}/models/${model}:streamGenerateContent`)) {
    category = 'wrong_endpoint'
    reason = 'Constructed URL does not match Gemini v1beta streamGenerateContent specification.'
  } else if (countKeyQueryParams(finalUrl) !== 1) {
    category = 'malformed_request'
    reason = `URL contains ${countKeyQueryParams(finalUrl)} key= parameters; expected exactly 1.`
  } else if (options?.googleReason === 'API_KEY_INVALID' || options?.googleStatus === 401) {
    category = 'invalid_key'
    reason =
      'Google rejected the loaded API key (API_KEY_INVALID). The key in AppConfig is not the same key that succeeds in curl, or it was revoked.'
  } else if (options?.googleStatus && options.googleStatus >= 400) {
    category = 'malformed_request'
    reason = `Google returned HTTP ${options.googleStatus} for the loaded key/model combination.`
  }

  return {
    loadedKeyPrefix: apiKey ? apiKey.slice(0, 10) : null,
    loadedKeySuffix: apiKey ? apiKey.slice(-6) : null,
    loadedModel: model,
    expectedModel: EXPECTED_GEMINI_MODEL,
    modelMatches: model === EXPECTED_GEMINI_MODEL,
    finalUrlTemplate: redactGeminiUrl(finalUrl),
    keyParamCount: countKeyQueryParams(finalUrl),
    endpoint: `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse&key=[REDACTED]`,
    reason,
    category,
  }
}
