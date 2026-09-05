import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { FastifyBaseLogger } from 'fastify'
import type { AppConfig } from '@nexoprep/config'
import { resolveRepoRoot, resolvePythonExecutable, getFreePort } from './launcher-utils.js'

/**
 * BehaviorEngineService
 *
 * Owns the Node <-> Python process boundary for the Behavior Engine
 * (behavior-engine/main.py). It does NOT know anything about posture,
 * gaze, scoring, or report formats — that logic is entirely inside the
 * Python engine and is never touched here (see docs/architecture.md,
 * Rule 2 & Rule 3: the Behavior Engine only observes, and its internals
 * are never modified by the backend).
 *
 * Responsibilities:
 *   - launch one Python process per interview session
 *   - track it by sessionId (never share/reuse a process across sessions)
 *   - allocate each session its own local MJPEG stream port (Phase 3C)
 *   - detect unexpected exits
 *   - log stdout/stderr
 *   - terminate gracefully on interview end (SIGTERM — the Python side
 *     now traps this and finalizes its own report before exiting; no
 *     keyboard/desktop interaction is involved anywhere in this flow)
 *   - never let a Behavior Engine failure crash NexoPrep
 *   - (Phase 4B) notify an optional handler when the Behavior Report has
 *     been finalized on disk, by observing a stdout marker the Python
 *     engine already prints (see onReportFinalized below). This is a
 *     detection hook only — this service still knows nothing about
 *     report.json's contents, format, or storage; that remains entirely
 *     the Behavior Engine's own concern.
 */

export type BehaviorEngineStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'unavailable'

/** Fired once per session when the Behavior Report has finished writing
 * to disk (behavior-engine/reports.py's ReportGenerator.save() completed).
 * `sessionDir` is resolved to an absolute path here since the Python
 * process prints it relative to its own cwd, not Node's. */
export interface BehaviorReportFinalizedInfo {
  sessionId: string
  sessionDir: string
}

interface TrackedProcess {
  sessionId: string
  pid: number
  child: ChildProcess
  status: BehaviorEngineStatus
  startedAt: string
  exitCode: number | null
  streamPort: number
  // The resolved working directory the Python process was spawned with.
  // Needed to turn the relative session_dir the engine prints (relative
  // to its own cwd) into an absolute path — see the stdout 'data' handler.
  cwd: string
  // Updated on every stdout chunk (see the 'data' listener in start()).
  // Used by stop()'s SIGKILL fallback to distinguish "hung process" from
  // "still actively writing a report" — see the comment on stop() below.
  lastActivityAt: number
}

export class BehaviorEngineService {
  private readonly processes = new Map<string, TrackedProcess>()

  constructor(
    private readonly config: AppConfig,
    private readonly logger: FastifyBaseLogger,
    // Optional (Phase 4B): invoked when the [BEHAVIOR_ENGINE_REPORT_FINALIZED]
    // stdout marker is observed for a session. Kept as a plain callback,
    // not a concrete service dependency, so this class stays ignorant of
    // Postgres/EventBus — whatever consumes this only needs to know a
    // report now exists at sessionDir. Errors thrown by the handler are
    // caught and logged; they never affect process lifecycle.
    private readonly onReportFinalized?: (info: BehaviorReportFinalizedInfo) => void,
  ) {}

  isEnabled(): boolean {
    return this.config.BEHAVIOR_ENGINE_ENABLED
  }

  /**
   * Starts the Behavior Engine for a session. No-op (with a warning log)
   * if a process is already tracked for this sessionId — this is what
   * prevents duplicate launches / multiple engines per interview.
   *
   * Never throws: a launch failure (missing python, missing engine dir,
   * etc.) is logged as [BEHAVIOR_ENGINE_ERROR] and the interview
   * continues without behavior tracking.
   */
  async start(sessionId: string): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.info({ sessionId }, '[BEHAVIOR_ENGINE_DISABLED] skipping start')
      return
    }

    const existing = this.processes.get(sessionId)
    if (existing && (existing.status === 'starting' || existing.status === 'running')) {
      this.logger.warn(
        { sessionId, pid: existing.pid },
        '[BEHAVIOR_ENGINE_DUPLICATE] engine already running for this session — ignoring duplicate start',
      )
      return
    }

    // ── Resolve cwd, python executable, entrypoint, and a free local
    //    port for this session's MJPEG stream — with full diagnostics
    //    logged before we even attempt to spawn anything ──
    const { root: repoRoot, resolvedFrom: rootResolvedFrom } = resolveRepoRoot()
    const cwd = path.resolve(repoRoot, this.config.BEHAVIOR_ENGINE_DIR)
    const entrypoint = this.config.BEHAVIOR_ENGINE_ENTRYPOINT
    const entrypointPath = path.join(cwd, entrypoint)
    const entrypointExists = existsSync(entrypointPath)

    const { command: pythonBin, resolvedFrom: pythonResolvedFrom, candidatesTried } =
      resolvePythonExecutable(this.config.BEHAVIOR_ENGINE_PYTHON_BIN)

    let streamPort: number
    try {
      streamPort = await getFreePort()
    } catch (error) {
      this.logger.error({ sessionId, error }, '[BEHAVIOR_ENGINE_ERROR] could not allocate a stream port — continuing without live preview')
      streamPort = 0
    }

    this.logger.info(
      {
        sessionId,
        repoRoot,
        repoRootResolvedFrom: rootResolvedFrom,
        cwd,
        entrypoint,
        entrypointPath,
        entrypointExists,
        pythonBin,
        pythonResolvedFrom,
        pythonCandidatesTried: candidatesTried,
        streamPort: streamPort || null,
      },
      '[BEHAVIOR_ENGINE_LAUNCH_DIAGNOSTICS]',
    )

    if (!entrypointExists) {
      this.logger.error(
        { sessionId, entrypointPath, cwd },
        '[BEHAVIOR_ENGINE_ERROR] entrypoint not found — check BEHAVIOR_ENGINE_DIR/BEHAVIOR_ENGINE_ENTRYPOINT; interview continues without behavior tracking',
      )
      return
    }

    let child: ChildProcess
    const spawnCommand = `${pythonBin} -u ${entrypoint}`
    try {
      child = spawn(pythonBin, ['-u', entrypoint], {
        cwd,
        // stdin is now a real pipe (was 'ignore') — stop() writes a
        // "STOP\n" line to it as the graceful-shutdown signal. See the
        // note on stop() for why this replaced SIGTERM as the primary
        // mechanism.
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // CPython buffers stdout in ~8KB blocks (not line-buffered)
          // whenever it isn't attached to a TTY — which is always true for
          // a child_process pipe. Without this, every print() in engine.py
          // (including the readiness markers this service depends on
          // below) can sit unflushed for a long time, or only appear in one
          // big burst right before the process exits. `-u` plus
          // PYTHONUNBUFFERED=1 (belt-and-braces — some platforms/venvs
          // don't propagate the CLI flag reliably) makes stdout/stderr
          // unbuffered, matching the manual `python -u main.py` repro that
          // was needed to see any output at all during diagnosis.
          PYTHONUNBUFFERED: '1',
          ...(streamPort ? { BEHAVIOR_ENGINE_STREAM_PORT: String(streamPort) } : {}),
        },
        // Detached=false: the child dies with the Node process (belt-and-braces
        // alongside the explicit onClose() cleanup in container.ts).
        detached: false,
      })
    } catch (error) {
      this.logger.error({ sessionId, spawnCommand, cwd, error }, '[BEHAVIOR_ENGINE_ERROR] failed to spawn process')
      return
    }

    // spawn() itself may still fail asynchronously (e.g. ENOENT if python
    // isn't installed) — that surfaces on the 'error' event, not a thrown
    // exception, so we handle it below rather than around spawn().
    const pid = child.pid ?? -1
    const tracked: TrackedProcess = {
      sessionId,
      pid,
      child,
      status: 'starting',
      startedAt: new Date().toISOString(),
      exitCode: null,
      streamPort,
      cwd,
      lastActivityAt: Date.now(),
    }
    this.processes.set(sessionId, tracked)

    this.logger.info({ sessionId, pid, cwd, entrypoint, pythonBin, streamPort }, '[BEHAVIOR_ENGINE_START]')

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      tracked.lastActivityAt = Date.now()
      this.logger.info({ sessionId, pid }, `[BEHAVIOR_ENGINE_STDOUT] ${text.trim()}`)

      // Readiness used to be "any stdout byte at all" — but the *first*
      // line the engine ever prints is [BEHAVIOR_ENGINE_CAMERA_READY],
      // emitted in engine.py before StreamServer.start() has even been
      // called (see engine.py's run()). Flipping to 'running' on that
      // byte meant getStreamTarget() could hand the proxy a port whose
      // HTTP server wasn't bound yet, and — combined with buffered stdout
      // arriving in one late burst — meant 'running' was sometimes only
      // reached long after (or never, within the retry window) the stream
      // was actually usable. Instead, wait for the specific marker that
      // corresponds to what getStreamTarget() promises: the MJPEG server
      // is listening. If this session was launched without a stream port
      // (streamPort === 0, e.g. getFreePort() failed), there is no stream
      // to wait for, so CAMERA_READY is the correct (and only) readiness
      // signal in that case.
      if (tracked.status === 'starting') {
        const streamIsReady = text.includes('[BEHAVIOR_ENGINE_STREAMING_STARTED]')
        const cameraIsReady = text.includes('[BEHAVIOR_ENGINE_CAMERA_READY]')
        if (streamIsReady || (!streamPort && cameraIsReady)) {
          tracked.status = 'running'
        }
      }

      // (Phase 4B) Detection only — added alongside the existing
      // readiness checks above without changing them, per the note on
      // this class's Responsibilities. engine.py prints this single
      // line, once, right after its own report-generation step
      // completes: "[BEHAVIOR_ENGINE_REPORT_FINALIZED] <session_dir>",
      // where <session_dir> is relative to this child process's own
      // cwd. A chunk can in principle contain a partial line, but this
      // mirrors the existing includes()-based checks above rather than
      // introducing a new line-buffering strategy in an already
      // recently-stabilized code path (see the class docstring).
      if (this.onReportFinalized) {
        const marker = '[BEHAVIOR_ENGINE_REPORT_FINALIZED]'
        const markerIndex = text.indexOf(marker)
        if (markerIndex !== -1) {
          const rest = text.slice(markerIndex + marker.length)
          const printedPath = rest.split(/\r?\n/, 1)[0]?.trim()
          if (printedPath) {
            const sessionDir = path.isAbsolute(printedPath) ? printedPath : path.resolve(tracked.cwd, printedPath)
            try {
              this.onReportFinalized({ sessionId, sessionDir })
            } catch (error) {
              this.logger.error(
                { sessionId, sessionDir, error },
                '[BEHAVIOR_ENGINE_ERROR] onReportFinalized handler failed — behavior report pointer not recorded',
              )
            }
          }
        }
      }
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      this.logger.warn({ sessionId, pid }, `[BEHAVIOR_ENGINE_STDERR] ${chunk.toString().trim()}`)
    })

    child.on('error', (error) => {
      // e.g. python binary not found — must not crash the interview
      tracked.status = 'unavailable'
      const code = (error as NodeJS.ErrnoException).code
      const diagnosis =
        code === 'ENOENT'
          ? `no working Python interpreter found — tried [${candidatesTried.join(', ')}]; set BEHAVIOR_ENGINE_PYTHON_BIN to an absolute path (e.g. C:\\Python312\\python.exe) if none of these are on PATH`
          : 'unexpected spawn error'
      this.logger.error(
        { sessionId, pid, spawnCommand, cwd, errorCode: code, error, diagnosis },
        '[BEHAVIOR_ENGINE_ERROR] process error — behavior tracking unavailable for this session',
      )
    })

    child.on('exit', (code, signal) => {
      tracked.exitCode = code
      const wasIntentional = tracked.status === 'stopping'
      tracked.status = wasIntentional ? 'stopped' : code === 0 ? 'stopped' : 'crashed'
      this.logger.info(
        { sessionId, pid, exitCode: code, signal, wasIntentional },
        '[BEHAVIOR_ENGINE_EXIT]',
      )
      if (!wasIntentional && code !== 0) {
        this.logger.warn(
          { sessionId, pid, exitCode: code },
          '[BEHAVIOR_ENGINE_ERROR] engine exited unexpectedly — interview continues unaffected',
        )
      }
      // Keep the final record around briefly for status checks, but drop the
      // ChildProcess handle so it can be garbage collected.
      this.processes.set(sessionId, { ...tracked })
    })
  }

  /**
   * Stops the Behavior Engine for a session (interview end). The
   * *only* graceful-shutdown signal sent up front is a "STOP\n" line
   * written to the child's stdin — engine.py reads this on a background
   * thread and finalizes its report before exiting (same report
   * generation the old [E] keypress used to trigger). This is
   * deliberately NOT SIGTERM: on Windows, Node's child_process has no
   * real signal delivery — `child.kill('SIGTERM')` calls
   * TerminateProcess() under the hood, which ends the process
   * immediately and never gives Python's `signal.signal(SIGTERM, ...)`
   * handler (or its main thread) a chance to run, so the report was
   * silently never written. A stdin write has no such platform gap.
   * SIGTERM is deliberately NOT sent alongside it — sending it
   * immediately raced against, and reliably beat, the graceful stdin
   * path, since the child's main thread needs to finish its current
   * frame and loop back around before it can even notice the stop
   * request. SIGTERM/SIGKILL are reserved entirely for the idle-timeout
   * escalation below, which only fires once the process has had a full
   * BEHAVIOR_ENGINE_STOP_TIMEOUT_MS window and still hasn't exited.
   *
   * Never throws — if nothing is tracked for this sessionId, this is a
   * no-op (e.g. engine was never enabled, or already stopped).
   */
  stop(sessionId: string): void {
    const tracked = this.processes.get(sessionId)
    if (!tracked || tracked.status === 'stopped' || tracked.status === 'crashed' || tracked.status === 'unavailable') {
      return
    }

    tracked.status = 'stopping'
    // Reset the idle clock here. lastActivityAt is only ever refreshed by
    // stdout data (see the 'data' listener in start()), and engine.py does
    // not print anything during the normal analysis loop — only at startup
    // (CAMERA_READY / STREAMING_STARTED / ANALYSIS_STARTED) and during
    // shutdown (STOP_SIGNAL_RECEIVED onward). Without this line, idleMs
    // below is measured from process *startup*, so on any interview longer
    // than BEHAVIOR_ENGINE_STOP_TIMEOUT_MS the very first watchdog tick
    // already sees idleMs over the limit and SIGKILLs the process before it
    // can read "STOP" off stdin or run its finally/report-generation block.
    // Resetting it here makes idleMs measure inactivity *after* shutdown
    // begins, which is what the watchdog is actually meant to track.
    tracked.lastActivityAt = Date.now()
    this.logger.info({ sessionId, pid: tracked.pid }, '[BEHAVIOR_ENGINE_STOP] requesting graceful shutdown')

    try {
      tracked.child.stdin?.write('STOP\n')
    } catch (error) {
      this.logger.warn({ sessionId, pid: tracked.pid, error }, '[BEHAVIOR_ENGINE_ERROR] stdin STOP write failed')
    }

    // No SIGTERM here. It used to be sent immediately, right alongside the
    // stdin write above — but "immediately" meant synchronously, in the
    // same tick, before engine.py's main thread (busy mid-frame in a
    // blocking cv2/MediaPipe call) had any chance to loop back around and
    // notice _stop_requested. On platforms where child.kill('SIGTERM') is
    // an uncatchable hard kill (e.g. Windows, where it maps to
    // TerminateProcess() — see class docstring above), that immediate call
    // was winning the race essentially every time: the stdin listener
    // thread had just enough time to print STOP_SIGNAL_RECEIVED, but the
    // process was torn down before the main thread could ever reach
    // engine.py's `finally` block, so no report was ever generated. The
    // stdin STOP is the graceful path and needs an actual window to work;
    // escalation is now left entirely to the idle-timeout poll below,
    // which only steps in once the process has genuinely stopped
    // responding.

    // Was a single flat setTimeout(..., BEHAVIOR_ENGINE_STOP_TIMEOUT_MS) counted
    // from the moment stop() was called. ReportGenerator.save() (JSON dump of
    // every frame log + 6 matplotlib dashboard renders) can legitimately take
    // longer than that on a machine that was just running MediaPipe/OpenCV
    // under load — a flat timer would SIGKILL it mid-write with no traceback,
    // silently producing "no report exists". Instead, poll on a short interval
    // and only SIGKILL once *no stdout output* (see lastActivityAt, updated on
    // every chunk above — the [BEHAVIOR_ENGINE_REPORT_STAGE] markers count as
    // activity) has been observed for the full configured window. A process
    // that's still actively writing keeps getting time; a truly hung one is
    // still killed within the same configured duration of true silence.
    const checkIntervalMs = 500
    const interval = setInterval(() => {
      const current = this.processes.get(sessionId)
      if (!current || current.status !== 'stopping') {
        clearInterval(interval)
        return
      }
      const idleMs = Date.now() - current.lastActivityAt
      if (idleMs >= this.config.BEHAVIOR_ENGINE_STOP_TIMEOUT_MS) {
        clearInterval(interval)
        this.logger.warn(
          { sessionId, pid: tracked.pid, idleMs },
          '[BEHAVIOR_ENGINE_STOP] no stdout activity within timeout — sending SIGKILL',
        )
        try {
          tracked.child.kill('SIGKILL')
        } catch (error) {
          this.logger.error({ sessionId, pid: tracked.pid, error }, '[BEHAVIOR_ENGINE_ERROR] SIGKILL failed')
        }
      }
    }, checkIntervalMs)
    interval.unref()
  }

  /** Read-only status lookup — used for monitoring, never for control flow. */
  getStatus(sessionId: string): { status: BehaviorEngineStatus; pid: number | null; exitCode: number | null } | null {
    const tracked = this.processes.get(sessionId)
    if (!tracked) return null
    return { status: tracked.status, pid: tracked.pid, exitCode: tracked.exitCode }
  }

  /**
   * Where this session's live MJPEG stream is being served (loopback
   * only — the frontend never talks to this port directly, it goes
   * through the Node proxy route). Returns null if there is no running
   * engine for this session, it wasn't given a port, or it hasn't
   * confirmed it's alive yet (status 'starting' — MediaPipe model
   * loading + camera open can take several seconds, during which the
   * stream server socket isn't bound yet; returning the port during
   * that window is what caused ECONNREFUSED). The frontend's retry loop
   * (see BehaviorCameraCard) covers the remaining small gap between
   * 'running' and the stream socket actually being bound.
   */
  getStreamTarget(sessionId: string): { host: '127.0.0.1'; port: number } | null {
    const tracked = this.processes.get(sessionId)
    if (!tracked || !tracked.streamPort) return null
    if (tracked.status !== 'running') return null
    return { host: '127.0.0.1', port: tracked.streamPort }
  }

  /** Terminates every tracked process. Called once, on server shutdown. */
  stopAll(): void {
    for (const sessionId of this.processes.keys()) {
      this.stop(sessionId)
    }
  }
}
