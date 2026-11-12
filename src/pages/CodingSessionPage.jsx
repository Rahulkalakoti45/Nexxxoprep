import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { EditorView } from '@codemirror/view'
import { getProblem, LANGUAGES } from '../features/coding/problems.js'
import { runCode, warmUpPython } from '../features/coding/runner.js'
import { localEvaluation, scriptedTurn, summarizeRun } from '../features/coding/interviewer.js'
import { persistAttempt } from '../features/coding/attemptSync.js'
import useInterview from '../hooks/useInterview.js'
import { codingTurn, evaluateCoding } from '../services/backend/codingApi.js'
import VoiceInput from '../modules/interview/components/interview/VoiceInput.jsx'
import { Badge, Button, EmptyState, Spinner } from '../components/ui/index.jsx'
import { cx } from '../components/ui/helpers.js'
import { IconArrowRight, IconCheck, IconSparkle, IconTarget } from '../components/ui/icons.jsx'

const DIFFICULTY_TONE = { Easy: 'good', Medium: 'warn', Hard: 'bad' }
const STAGE_LABEL = { approach: 'Explain your approach', coding: 'Coding', wrapup: 'Wrap-up' }

// Matches the app's surfaces so the editor doesn't look bolted on.
const editorTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#0b0d13', fontSize: '14px', height: '100%' },
    '.cm-gutters': { backgroundColor: '#0b0d13', borderRight: '1px solid rgba(255,255,255,0.07)', color: '#5d6375' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'rgba(126,105,255,0.07)' },
    '.cm-content': { fontFamily: '"JetBrains Mono", ui-monospace, monospace', padding: '12px 0' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { overflow: 'auto' },
  },
  { dark: true },
)

function draftKey(problemId, language) {
  return `nexoprep_coding_draft_${problemId}_${language}`
}

function loadDraft(problem, language) {
  try {
    return localStorage.getItem(draftKey(problem.id, language)) ?? problem.starter[language]
  } catch {
    return problem.starter[language]
  }
}

function useElapsed(startedAt) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/** Renders `backtick` spans in problem text as inline code. */
function RichText({ text }) {
  return text.split('\n\n').map((para, i) => (
    <p key={i} className="leading-relaxed text-ink-soft">
      {para.split(/(`[^`]+`)/g).map((part, j) =>
        part.startsWith('`') ? (
          <code key={j} className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[13px] text-brand-200">
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </p>
  ))
}

function ProblemPane({ problem }) {
  return (
    <div className="space-y-5 text-[15px]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-semibold text-ink">{problem.title}</h1>
          <Badge tone={DIFFICULTY_TONE[problem.difficulty]}>{problem.difficulty}</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-muted">{problem.topics.join(' · ')}</p>
      </div>
      <div className="space-y-3">
        <RichText text={problem.prompt} />
      </div>
      {problem.examples.map((ex, i) => (
        <div key={i} className="rounded-xl border border-line bg-inset p-3.5 font-mono text-[13px]">
          <p className="mb-1.5 font-sans text-xs font-semibold uppercase tracking-wider text-ink-faint">Example {i + 1}</p>
          <p className="text-ink-soft">
            <span className="text-ink-faint">Input: </span>
            {ex.input}
          </p>
          <p className="text-ink-soft">
            <span className="text-ink-faint">Output: </span>
            {ex.output}
          </p>
          {ex.explanation ? <p className="mt-1 font-sans text-xs text-ink-muted">{ex.explanation}</p> : null}
        </div>
      ))}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Constraints</p>
        <ul className="mt-2 space-y-1 font-mono text-[13px] text-ink-soft">
          {problem.constraints.map((c) => (
            <li key={c}>• {c}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ChatPane({ messages, pending, onSend, stage, aiMode, disabled }) {
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, pending])

  const send = () => {
    const text = draft.trim()
    if (!text || pending || disabled) return
    onSend(text)
    setDraft('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5 border-b border-line pb-3">
        <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #efeaff 0%, #9d8cff 30%, #5640d6 75%)' }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Interviewer</p>
          <p className="text-xs text-ink-muted">{STAGE_LABEL[stage]}</p>
        </div>
        {aiMode === 'scripted' ? (
          <span className="ml-auto" title="The AI interviewer isn't available, so a simpler built-in one is responding.">
            <Badge>Built-in interviewer</Badge>
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3" role="log" aria-live="polite" aria-label="Interviewer conversation">
        {messages.map((m, i) => (
          <div key={i} className={cx('flex', m.role === 'candidate' ? 'justify-end' : 'justify-start')}>
            <div
              className={cx(
                'max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                m.role === 'candidate' ? 'rounded-br-md bg-brand-500/90 text-white' : 'rounded-bl-md border border-line bg-raised text-ink',
                m.kind === 'hint' ? 'border-amber-400/30 bg-amber-400/[0.08]' : '',
              )}
            >
              {m.kind === 'hint' ? <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-amber-300">Hint</span> : null}
              {m.content}
            </div>
          </div>
        ))}
        {pending ? (
          <div className="flex gap-1 px-2 py-1" aria-label="Interviewer is typing">
            {[0, 150, 300].map((d) => (
              <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-brand-300/80" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <div className="rounded-2xl border border-line-strong bg-inset focus-within:border-brand-400/60">
        <label htmlFor="coding-chat" className="sr-only">
          Message the interviewer
        </label>
        <textarea
          id="coding-chat"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          disabled={disabled}
          rows={2}
          placeholder={stage === 'approach' ? 'Explain your approach… (Enter to send)' : 'Think out loud, ask a question…'}
          className="block w-full resize-none bg-transparent px-3.5 pt-3 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <VoiceInput onTranscript={setDraft} />
          <Button size="sm" onClick={send} disabled={!draft.trim() || pending || disabled}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

function ResultsPane({ run, status, mode }) {
  if (status === 'loading-python') {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-ink-muted">
        <Spinner /> Downloading Python (first time only)…
      </p>
    )
  }
  if (status === 'running') {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-ink-muted">
        <Spinner /> {mode === 'submit' ? 'Running all tests, including hidden ones…' : 'Running the examples…'}
      </p>
    )
  }
  if (!run) return <p className="p-4 text-sm text-ink-muted">Run your code to test it against the examples. Submit runs the hidden tests too.</p>

  return (
    <div className="space-y-3 p-4">
      {run.compileError ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 font-mono text-[13px] text-rose-100">{run.compileError}</div>
      ) : (
        <p className={cx('text-sm font-semibold', run.passed === run.total ? 'text-emerald-300' : 'text-amber-200')}>
          {run.passed === run.total ? 'All tests passed' : `${run.passed} of ${run.total} tests passed`}
          {run.hiddenTotal ? <span className="font-normal text-ink-muted"> · hidden {run.hiddenPassed}/{run.hiddenTotal}</span> : null}
        </p>
      )}
      <ul className="space-y-2">
        {run.results.map((r) => (
          <li key={r.index} className={cx('rounded-xl border p-3 text-[13px]', r.passed ? 'border-emerald-400/20 bg-emerald-400/[0.04]' : 'border-rose-400/25 bg-rose-400/[0.05]')}>
            <div className="flex items-center gap-2">
              <span className={cx('grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold', r.passed ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200')}>
                {r.passed ? '✓' : '✕'}
              </span>
              <span className="font-medium text-ink">{r.hidden ? `Hidden test${r.label ? `: ${r.label}` : ''}` : `Example ${r.index + 1}${r.label ? `: ${r.label}` : ''}`}</span>
              {r.ms !== null ? <span className="ml-auto font-mono text-[11px] text-ink-faint">{r.ms} ms</span> : null}
            </div>
            {!r.hidden ? (
              <div className="mt-2 space-y-0.5 font-mono text-ink-soft">
                <p>
                  <span className="text-ink-faint">in </span>
                  {r.input}
                </p>
                <p>
                  <span className="text-ink-faint">expected </span>
                  {r.expected}
                </p>
                {r.passed ? null : (
                  <p className={r.error ? 'text-rose-200' : ''}>
                    <span className="text-ink-faint">got </span>
                    {r.error || r.actual}
                  </p>
                )}
              </div>
            ) : r.error && !r.passed ? (
              <p className="mt-1.5 font-mono text-rose-200">{r.error}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {run.logs.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Console</p>
          <pre className="mt-1.5 max-h-40 overflow-auto rounded-xl border border-line bg-inset p-3 font-mono text-[12px] text-ink-soft">{run.logs.join('\n')}</pre>
        </div>
      ) : null}
    </div>
  )
}

export default function CodingSessionPage() {
  const { problemId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useInterview()
  const problem = getProblem(problemId)
  const language = LANGUAGES.some((l) => l.id === searchParams.get('lang')) ? searchParams.get('lang') : 'javascript'

  const [startedAt] = useState(() => Date.now())
  const elapsed = useElapsed(startedAt)
  const [code, setCode] = useState(() => (problem ? loadDraft(problem, language) : ''))
  const [stage, setStage] = useState('approach')
  const [messages, setMessages] = useState([])
  const [pending, setPending] = useState(false)
  const [aiMode, setAiMode] = useState('ai')
  const [hintsUsed, setHintsUsed] = useState(0)
  const [run, setRun] = useState(null)
  const [runStatus, setRunStatus] = useState('idle')
  const [runMode, setRunMode] = useState('run')
  const [finalRun, setFinalRun] = useState(null)
  const [finishing, setFinishing] = useState(false)
  const [leftTab, setLeftTab] = useState('problem')
  const [unread, setUnread] = useState(0)
  const started = useRef(false)
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const extensions = useMemo(
    () => [language === 'python' ? python() : javascript(), editorTheme, EditorView.lineWrapping, EditorView.contentAttributes.of({ 'aria-label': 'Code editor' })],
    [language],
  )

  // Save the draft so a refresh never loses work.
  useEffect(() => {
    if (!problem) return
    try {
      localStorage.setItem(draftKey(problem.id, language), code)
    } catch {
      // Drafts are a convenience only.
    }
  }, [code, problem, language])

  useEffect(() => {
    if (language === 'python') warmUpPython().catch(() => undefined)
  }, [language])

  const problemContext = useMemo(
    () =>
      problem && {
        title: problem.title,
        difficulty: problem.difficulty,
        prompt: problem.prompt,
        expectedComplexity: problem.expectedComplexity,
        followUps: problem.followUps,
      },
    [problem],
  )

  /** Asks the AI interviewer for its next line, or the built-in one if the AI is unavailable. */
  const askInterviewer = useCallback(
    async (event, { history, lastRun = null, hint = null, stageOverride } = {}) => {
      const currentStage = stageOverride || stage
      const input = { problem: problemContext, stage: currentStage, event, language, code, messages: history.map(({ role, content }) => ({ role, content })), lastRun, hint }
      setPending(true)
      let turn
      if (aiMode === 'ai') {
        try {
          turn = await codingTurn(input)
        } catch {
          setAiMode('scripted')
        }
      }
      if (!turn) turn = scriptedTurn({ ...input, problem })
      setPending(false)
      setMessages((prev) => [...prev, { role: 'interviewer', content: turn.reply, kind: event === 'hint' ? 'hint' : undefined }])
      setUnread((n) => n + 1)
      if (turn.readyToCode && currentStage === 'approach') setStage('coding')
    },
    [aiMode, code, language, problem, problemContext, stage],
  )

  useEffect(() => {
    if (!problem || started.current) return
    started.current = true
    void askInterviewer('start', { history: [] })
  }, [askInterviewer, problem])

  if (!problem) {
    return <EmptyState title="Problem not found" body="It may have been removed." action={<Link to="/coding" className="text-brand-300">Pick another problem</Link>} />
  }

  const sendMessage = (text) => {
    const history = [...messagesRef.current, { role: 'candidate', content: text }]
    setMessages(history)
    void askInterviewer('message', { history })
  }

  const execute = async (mode) => {
    if (runStatus === 'running' || runStatus === 'loading-python') return
    setRunMode(mode)
    let graded
    try {
      graded = await runCode({ language, code, problem, includeHidden: mode === 'submit', onStatus: setRunStatus })
    } catch (error) {
      setRunStatus('idle')
      setRun({ results: [], passed: 0, total: 0, compileError: error.message, logs: [] })
      return
    }
    setRunStatus('idle')
    setRun(graded)
    const nextStage = mode === 'submit' ? 'wrapup' : stage === 'approach' ? 'coding' : stage
    setStage(nextStage)
    if (mode === 'submit') setFinalRun(graded)
    void askInterviewer(mode === 'submit' ? 'submit' : 'run', { history: messagesRef.current, lastRun: summarizeRun(graded), stageOverride: nextStage })
  }

  const takeHint = () => {
    if (hintsUsed >= problem.hints.length || pending) return
    const hint = problem.hints[hintsUsed]
    setHintsUsed((n) => n + 1)
    setLeftTab('chat')
    void askInterviewer('hint', { history: messagesRef.current, hint })
  }

  const finish = async () => {
    if (!finalRun || finishing) return
    setFinishing(true)
    const payload = {
      problem: problemContext,
      language,
      code,
      messages: messagesRef.current.map(({ role, content }) => ({ role, content })),
      finalRun: summarizeRun(finalRun),
      hintsUsed,
      durationSeconds: elapsed,
    }
    let evaluation = null
    if (aiMode === 'ai') {
      try {
        evaluation = await evaluateCoding(payload)
      } catch {
        evaluation = null
      }
    }
    if (!evaluation) evaluation = localEvaluation({ problem, finalRun: payload.finalRun, messages: payload.messages, hintsUsed })

    const id = `${problem.id}-${Date.now()}`
    // Saved on this device immediately; the upload finishes in the background (and is retried
    // next time if it fails), so the results open without waiting on the network.
    void persistAttempt(user?.id, {
      id,
      problemId: problem.id,
      problemTitle: problem.title,
      difficulty: problem.difficulty,
      language,
      languageLabel: LANGUAGES.find((l) => l.id === language)?.label,
      code,
      messages: messagesRef.current,
      finalRun: { ...payload.finalRun, results: finalRun.results },
      hintsUsed,
      durationSeconds: elapsed,
      finishedAt: new Date().toISOString(),
      evaluation,
    })
    try {
      localStorage.removeItem(draftKey(problem.id, language))
    } catch {
      // Nothing to clean up.
    }
    navigate(`/coding/result/${id}`)
  }

  const busy = runStatus === 'running' || runStatus === 'loading-python'
  const stageSteps = ['approach', 'coding', 'wrapup']

  return (
    <div className="space-y-3">
      {/* Top bar: where you are, time, and the main actions. */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
        <Link to="/coding" className="text-sm text-ink-muted hover:text-ink">
          ← Problems
        </Link>
        <span className="hidden h-5 w-px bg-line-strong sm:block" aria-hidden="true" />
        <ol className="hidden items-center gap-1.5 text-xs md:flex" aria-label="Interview stage">
          {stageSteps.map((s, i) => {
            const idx = stageSteps.indexOf(stage)
            return (
              <li key={s} className="flex items-center gap-1.5">
                {i > 0 ? <span className="h-px w-4 bg-line-strong" aria-hidden="true" /> : null}
                <span
                  aria-current={s === stage ? 'step' : undefined}
                  className={cx('rounded-full px-2.5 py-1 font-medium', s === stage ? 'bg-brand-500/20 text-brand-200' : i < idx ? 'text-ink-soft' : 'text-ink-faint')}
                >
                  {i < idx ? '✓ ' : ''}
                  {STAGE_LABEL[s]}
                </span>
              </li>
            )
          })}
        </ol>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-line bg-inset px-2.5 py-1 font-mono text-sm tabular-nums text-ink">{clock(elapsed)}</span>
          <Button variant="ghost" size="sm" onClick={takeHint} disabled={hintsUsed >= problem.hints.length || pending || stage === 'wrapup'}>
            <IconSparkle className="h-4 w-4" /> Hint {hintsUsed}/{problem.hints.length}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => execute('run')} disabled={busy || stage === 'wrapup'}>
            {busy && runMode === 'run' ? <Spinner /> : '▶'} Run
          </Button>
          {stage === 'wrapup' ? (
            <Button size="sm" onClick={finish} disabled={finishing || pending}>
              {finishing ? <Spinner /> : <IconCheck className="h-4 w-4" />} {finishing ? 'Scoring…' : 'Finish & get feedback'}
            </Button>
          ) : (
            <Button size="sm" onClick={() => execute('submit')} disabled={busy}>
              {busy && runMode === 'submit' ? <Spinner /> : <IconArrowRight className="h-4 w-4" />} Submit
            </Button>
          )}
        </div>
      </div>

      {stage === 'approach' && messages.length <= 2 ? (
        <p className="flex items-center gap-2 rounded-xl border border-brand-400/20 bg-brand-500/[0.07] px-4 py-2.5 text-sm text-ink-soft">
          <IconTarget className="h-4 w-4 shrink-0 text-brand-300" /> Like a real interview: explain your approach to the interviewer before you start coding. It counts toward your score.
        </p>
      ) : null}
      {stage === 'wrapup' ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2.5 text-sm text-ink-soft">
          <IconCheck className="h-4 w-4 shrink-0 text-emerald-300" /> Submitted. Answer the interviewer&apos;s last question, then press Finish &amp; get feedback.
        </p>
      ) : null}

      <div className="grid gap-3 lg:h-[calc(100vh-13rem)] lg:min-h-[560px] lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        {/* Left column below xl: Problem / Interviewer tabs. */}
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1 text-sm lg:col-start-1 lg:row-start-1 lg:self-start xl:hidden" role="tablist" aria-label="Left panel">
          {[
            ['problem', 'Problem'],
            ['chat', 'Interviewer'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={leftTab === id}
              onClick={() => {
                setLeftTab(id)
                if (id === 'chat') setUnread(0)
              }}
              className={cx('flex-1 rounded-lg px-3 py-1.5 font-medium transition', leftTab === id ? 'bg-white/[0.09] text-ink' : 'text-ink-muted hover:text-ink')}
            >
              {label}
              {id === 'chat' && unread && leftTab !== 'chat' ? <span className="ml-1.5 rounded-full bg-brand-500 px-1.5 text-[11px] text-white">{unread}</span> : null}
            </button>
          ))}
        </div>

        <section
          className={cx(
            'min-h-0 overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-card lg:col-start-1 lg:row-start-1 lg:mt-12 xl:mt-0 xl:block',
            leftTab === 'problem' ? 'block' : 'hidden',
          )}
        >
          <ProblemPane problem={problem} />
        </section>

        <section
          className={cx(
            'flex min-h-[420px] flex-col rounded-2xl border border-line bg-surface p-4 shadow-card lg:col-start-1 lg:row-start-1 lg:mt-12 lg:min-h-0 xl:col-start-3 xl:mt-0 xl:flex',
            leftTab === 'chat' ? 'flex' : 'hidden',
          )}
        >
          <ChatPane messages={messages} pending={pending} onSend={sendMessage} stage={stage} aiMode={aiMode} disabled={finishing} />
        </section>

        {/* Editor and results. */}
        <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card lg:col-start-2 lg:row-start-1 lg:min-h-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-ink-muted">
            <span className="font-mono">{problem.functionName[language]}.{language === 'python' ? 'py' : 'js'}</span>
            <span>{LANGUAGES.find((l) => l.id === language)?.label} · saved as you type</span>
          </div>
          <div className="min-h-[260px] flex-[3] overflow-hidden">
            <CodeMirror
              value={code}
              onChange={setCode}
              height="100%"
              theme="dark"
              extensions={extensions}
              basicSetup={{ foldGutter: false, highlightActiveLine: true, autocompletion: true, tabSize: language === 'python' ? 4 : 2 }}
              className="h-full"
            />
          </div>
          <div className="min-h-[160px] flex-[2] overflow-y-auto border-t border-line bg-canvas/40">
            <ResultsPane run={run} status={runStatus} mode={runMode} />
          </div>
        </section>
      </div>
    </div>
  )
}
