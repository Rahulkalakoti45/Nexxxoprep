import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'

/**
 * Launcher utilities for the Behavior Engine child process.
 *
 * These two problems are independent of everything in
 * behavior-engine.service.ts's process-management logic, so they live
 * here rather than being inlined — same reasoning as
 * packages/config/src/env-path.ts, which this repo-root walk mirrors.
 */

const MAX_WALK_DEPTH = 10

/**
 * Finds the monorepo root by walking up from `startDir` looking for the
 * root package.json (the one declaring npm workspaces). This is the fix
 * for the cwd bug: `npm run dev -w @nexoprep/server` runs the script with
 * process.cwd() set to apps/server, NOT the repo root, so resolving
 * BEHAVIOR_ENGINE_DIR against process.cwd() silently produced
 * apps/server/behavior-engine instead of <root>/behavior-engine.
 *
 * Deliberately generic (looks for the "workspaces" field, not any
 * project-specific folder name) so it isn't a NexoPrep-only hack.
 */
export function resolveRepoRoot(startDir = process.cwd()): { root: string; resolvedFrom: 'workspaces-marker' | 'fallback-cwd'; candidatesChecked: string[] } {
  const candidatesChecked: string[] = []
  let dir = startDir

  for (let depth = 0; depth < MAX_WALK_DEPTH; depth += 1) {
    const candidate = resolve(dir, 'package.json')
    candidatesChecked.push(candidate)
    if (existsSync(candidate)) {
      try {
        const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as { workspaces?: unknown }
        if (parsed.workspaces) {
          return { root: dir, resolvedFrom: 'workspaces-marker', candidatesChecked }
        }
      } catch {
        // Malformed package.json — keep walking up.
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  // No workspaces root found — fall back to process.cwd() rather than
  // throwing, so behavior tracking degrades gracefully instead of
  // blocking the interview.
  return { root: startDir, resolvedFrom: 'fallback-cwd', candidatesChecked }
}

export type PythonResolution = {
  command: string
  resolvedFrom: 'configured' | 'auto-detected'
  candidatesTried: string[]
}

/** Platform-appropriate, in-order guesses. No Windows-only hacks — every
 * candidate is tried the same way on every platform; the only difference
 * is which names are likely to exist. On Windows, `py` (the official
 * Python Launcher, installed to C:\Windows\py.exe) is tried before a bare
 * `python`/`python3`, because those names are frequently Microsoft Store
 * "app execution alias" stubs that run fine when typed in a terminal but
 * fail when invoked directly via child_process.spawn — exactly the
 * "works in my terminal, ENOENT from Node" symptom this fix addresses. */
function platformCandidates(): string[] {
  return process.platform === 'win32'
    ? ['py', 'python', 'python3']
    : ['python3', 'python']
}

function canRun(command: string): boolean {
  try {
    const result = spawnSync(command, ['--version'], {
      stdio: 'ignore',
      windowsHide: true,
      timeout: 3000, // guards against a hanging Microsoft Store alias stub
    })
    // result.error is set (e.g. ENOENT) when the executable could not be
    // found/launched at all; a non-zero exit code from --version itself
    // still means the interpreter exists and runs.
    return !result.error
  } catch {
    return false
  }
}

let cachedResolution: PythonResolution | null = null

/**
 * Resolves a working Python executable, preferring the configured value
 * (BEHAVIOR_ENGINE_PYTHON_BIN) but falling back through a cross-platform
 * candidate list rather than failing outright — this is what turns a
 * hardcoded "python3" default (fine on Linux/macOS, ENOENT on most
 * Windows installs) into something that works everywhere. Result is
 * memoized for the lifetime of the process.
 */
export function resolvePythonExecutable(configured: string | undefined): PythonResolution {
  if (cachedResolution) return cachedResolution

  const candidatesTried: string[] = []
  const configuredTrimmed = configured?.trim()

  if (configuredTrimmed) {
    candidatesTried.push(configuredTrimmed)
    if (canRun(configuredTrimmed)) {
      cachedResolution = { command: configuredTrimmed, resolvedFrom: 'configured', candidatesTried }
      return cachedResolution
    }
  }

  for (const candidate of platformCandidates()) {
    if (candidatesTried.includes(candidate)) continue
    candidatesTried.push(candidate)
    if (canRun(candidate)) {
      cachedResolution = { command: candidate, resolvedFrom: 'auto-detected', candidatesTried }
      return cachedResolution
    }
  }

  cachedResolution = { command: configuredTrimmed || platformCandidates()[0]!, resolvedFrom: 'auto-detected', candidatesTried }
  return cachedResolution
}

/** Test-only: clears the memoized python resolution. */
export function _resetPythonResolutionCache(): void {
  cachedResolution = null
}

/**
 * Asks the OS for a free local port (binds to port 0, reads back what
 * the kernel assigned, releases it immediately). Used to give each
 * session's Behavior Engine process its own MJPEG stream port so
 * multiple concurrent interviews never collide — no fixed port to
 * configure, no per-session port bookkeeping beyond what
 * BehaviorEngineService already tracks per sessionId.
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        const port = address.port
        server.close(() => resolvePort(port))
      } else {
        server.close(() => reject(new Error('Could not determine free port')))
      }
    })
  })
}
