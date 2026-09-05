import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadDotEnv, type DotenvConfigOutput } from 'dotenv'

const MAX_WALK_DEPTH = 10

export type EnvFileResolution = {
  processCwd: string
  candidatesChecked: string[]
  resolvedEnvPath: string | null
  resolvedEnvExists: boolean
  packageDir: string
}

export type DotenvLoadReport = {
  resolution: EnvFileResolution
  dotenvLoaded: boolean
  dotenvError: string | null
  parsedKeyCount: number
  geminiKeyLoadedFromDotenv: boolean
  geminiKeyPrefixAfterLoad: string | null
  processEnvGeminiPrefixBeforeLoad: string | null
}

export function resolveProjectEnvPath(startDir = process.cwd()): EnvFileResolution {
  const candidatesChecked: string[] = []
  let dir = startDir

  for (let depth = 0; depth < MAX_WALK_DEPTH; depth += 1) {
    const candidate = resolve(dir, '.env')
    candidatesChecked.push(candidate)
    if (existsSync(candidate)) {
      return {
        processCwd: startDir,
        candidatesChecked,
        resolvedEnvPath: candidate,
        resolvedEnvExists: true,
        packageDir: dirname(fileURLToPath(import.meta.url)),
      }
    }

    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return {
    processCwd: startDir,
    candidatesChecked,
    resolvedEnvPath: null,
    resolvedEnvExists: false,
    packageDir: dirname(fileURLToPath(import.meta.url)),
  }
}

let cachedDotenvReport: DotenvLoadReport | null = null

export function loadProjectDotenv(startDir = process.cwd()): DotenvLoadReport {
  if (cachedDotenvReport) return cachedDotenvReport

  const processEnvGeminiPrefixBeforeLoad = process.env.GEMINI_API_KEY?.slice(0, 10) ?? null
  const resolution = resolveProjectEnvPath(startDir)

  let dotenvResult: DotenvConfigOutput | null = null
  if (resolution.resolvedEnvPath) {
    dotenvResult = loadDotEnv({
      path: resolution.resolvedEnvPath,
      override: true,
    })
  }

  const parsedKeyCount = dotenvResult?.parsed ? Object.keys(dotenvResult.parsed).length : 0

  cachedDotenvReport = {
    resolution,
    dotenvLoaded: Boolean(resolution.resolvedEnvPath && !dotenvResult?.error),
    dotenvError: dotenvResult?.error ? dotenvResult.error.message : null,
    parsedKeyCount,
    geminiKeyLoadedFromDotenv: Boolean(dotenvResult?.parsed?.GEMINI_API_KEY),
    geminiKeyPrefixAfterLoad: process.env.GEMINI_API_KEY?.slice(0, 10) ?? null,
    processEnvGeminiPrefixBeforeLoad,
  }

  return cachedDotenvReport
}

export function readGeminiKeyFromResolvedEnvFile(startDir = process.cwd()): {
  key: string | null
  envPath: string | null
} {
  const resolution = resolveProjectEnvPath(startDir)
  if (!resolution.resolvedEnvPath) {
    return { key: null, envPath: null }
  }

  const content = readFileSync(resolution.resolvedEnvPath, 'utf8')
  const match = content.match(/^GEMINI_API_KEY=(.*)$/m)
  if (!match?.[1]) {
    return { key: null, envPath: resolution.resolvedEnvPath }
  }

  let value = match[1].trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return {
    key: value.length > 0 ? value : null,
    envPath: resolution.resolvedEnvPath,
  }
}

export function getDotenvLoadReport(): DotenvLoadReport | null {
  return cachedDotenvReport
}
