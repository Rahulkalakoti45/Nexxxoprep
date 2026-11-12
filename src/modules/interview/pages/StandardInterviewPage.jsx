import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useInterview from '../../../hooks/useInterview.js'
import { generateInterviewReport } from '../../../services/interviewService.js'
import InterviewLayout from '../components/interview/InterviewLayout'
import InterviewSidebar from '../components/interview/InterviewSidebar'
import QuestionCard from '../components/interview/QuestionCard'
import TimerPanel from '../components/interview/TimerPanel'
import VoiceInput from '../components/interview/VoiceInput'
import ErrorState from '../components/shared/ErrorState'
import LoadingScreen from '../components/shared/LoadingScreen'
import AISimulatedInterviewPage from './AISimulatedInterviewPage'
import { InterviewProvider } from '../context/InterviewContext'
import { useInterviewSession } from '../hooks/useInterviewSession'
import { buildAnswerEntriesFromSession, buildTimingFromSession } from '../utils/reportAdapter.js'
import { flushSyncQueue } from '../../../lib/syncQueue.js'
import { Button, Spinner } from '../../../components/ui/index.jsx'
import { IconArrowRight, IconCheck, IconMic } from '../../../components/ui/icons.jsx'

function DebugPanel({ session, currentQuestion, roundIndex, errors }) {
  if (!import.meta.env.DEV) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-line bg-black/80 p-3 text-xs text-ink backdrop-blur">
      <p className="font-semibold">Interview Debug</p>
      <p>session: {session?.sessionId ? 'loaded' : 'no'}</p>
      <p>mode: {session?.interviewMode}</p>
      <p>questions: {session?.questions?.length || 0}</p>
      <p>qIndex: {session?.currentQuestionIndex ?? 0}</p>
      <p>roundIndex: {roundIndex}</p>
      <p>questionId: {currentQuestion?.id || '—'}</p>
      <p>errors: {errors?.length || 0}</p>
    </div>
  )
}

function StandardInterviewInner() {
  const navigate = useNavigate()
  const { resume, saveReport, user } = useInterview()
  const { session, status, errors, actions, currentQuestion, currentRoundIndex } = useInterviewSession({
    autoBootstrap: true,
  })

  const [answer, setAnswer] = useState('')
  const [thinking, setThinking] = useState(false)
  const [displayIndex, setDisplayIndex] = useState(0)
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now())
  const [lastEvaluation, setLastEvaluation] = useState(null)
  const [reporting, setReporting] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)

  useEffect(() => {
    if (!currentQuestion?.question) return
    setAnswer('')
    setDisplayIndex(0)
    setQuestionStartedAt(Date.now())
  }, [currentQuestion?.id, currentQuestion?.question])

  useEffect(() => {
    if (!currentQuestion?.question) return undefined
    const full = currentQuestion.question
    if (displayIndex >= full.length) return undefined
    const t = setTimeout(() => setDisplayIndex((p) => Math.min(p + 2, full.length)), 12)
    return () => clearTimeout(t)
  }, [currentQuestion?.question, displayIndex])

  const displayed = useMemo(() => {
    if (!currentQuestion?.question) return ''
    return currentQuestion.question.slice(0, displayIndex)
  }, [currentQuestion?.question, displayIndex])

  const interviewStartedAt = useMemo(() => {
    if (!session?.startedAt) return Date.now()
    const ms = new Date(session.startedAt).getTime()
    return Number.isFinite(ms) ? ms : Date.now()
  }, [session?.startedAt])

  const isCompleted = session && (status === 'completed' || session.currentQuestionIndex >= session.questions.length)

  useEffect(() => {
    if (!isCompleted || reporting) return
    // Auto-generate report once on completion, then route to /report.
    const run = async () => {
      try {
        setReporting(true)
        await flushSyncQueue()
        const answerEntries = buildAnswerEntriesFromSession(session)
        const timing = buildTimingFromSession(session, answerEntries)
        const report = await generateInterviewReport(
          {
            config: {
              role: session.role,
              company: session.company,
              difficulty: session.difficulty,
              mode: session.interviewMode,
            },
            answers: answerEntries,
            durationSeconds: timing.durationSeconds,
            timing: timing.timing,
            followUpMetrics: {
              followUpAsked: (session.questions || []).filter((q) => q?.isFollowUp).length,
            },
          },
          { userId: user?.id, backendSessionId: session.backendSessionId },
        )
        saveReport(report)
        navigate(session.backendSessionId ? `/report/${session.backendSessionId}` : '/report')
      } catch (_e) {
        setReporting(false)
      }
    }
    run()
  }, [isCompleted, navigate, reporting, saveReport, session, user?.id])

  if (errors?.length && !session) {
    return <ErrorState title="We couldn’t load your interview" message={errors[0]} onRetry={() => actions.bootstrap({ resume })} />
  }

  if (!session) {
    return <LoadingScreen title="Loading your interview…" subtitle="Picking up right where you left off." />
  }

  if (session.interviewMode === 'ai_simulated') {
    return <AISimulatedInterviewPage />
  }

  if (isCompleted) {
    return (
      <section className="mx-auto mt-6 flex max-w-lg flex-col items-center rounded-3xl border border-line-strong bg-surface p-10 text-center shadow-card">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300">
          <IconCheck className="h-7 w-7" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold text-ink">Nice work. That&apos;s a wrap.</h2>
        <p className="mt-2 text-ink-muted">
          You answered {session.progress.answered} of {session.progress.total} questions.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-ink-soft">
          {reporting ? <Spinner /> : null}
          {reporting ? 'Writing your report…' : 'Your report opens automatically.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Back to home
          </Button>
        </div>
        <DebugPanel session={session} currentQuestion={currentQuestion} roundIndex={currentRoundIndex} errors={errors} />
      </section>
    )
  }

  const onSubmitNext = (statusType = 'answered') => {
    const timeTakenSeconds = (Date.now() - questionStartedAt) / 1000
    const evaluation = actions.submitWithStatus({ answerText: answer, status: statusType, timeTakenSeconds })
    if (statusType !== 'skipped' && evaluation) setLastEvaluation(evaluation)
    setThinking(true)
    setTimeout(() => {
      actions.next()
      setThinking(false)
    }, 360)
  }

  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0
  const canSubmit = Boolean(answer.trim()) && !thinking

  const left = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">
            Round {currentRoundIndex + 1} of {session.rounds.length}
          </p>
          <p className="truncate font-display text-lg font-semibold text-ink">
            {session.role} <span className="font-sans text-base font-normal text-ink-muted">at {session.company}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => actions.switchMode('ai_simulated')}
            className="hidden h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-ink-muted transition hover:bg-white/[0.06] hover:text-ink sm:inline-flex"
          >
            <IconMic className="h-4 w-4" /> Switch to voice
          </button>
          {confirmEnd ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-1 pl-3 text-sm text-rose-100">
              End now?
              <button type="button" onClick={() => setConfirmEnd(false)} className="rounded-lg px-2.5 py-1 font-semibold text-ink-soft hover:bg-white/[0.06]">
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  actions.clear()
                  navigate('/setup')
                }}
                className="rounded-lg bg-rose-500 px-2.5 py-1 font-semibold text-white hover:bg-rose-400"
              >
                Yes, end
              </button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(true)}>
              End
            </Button>
          )}
        </div>
      </div>

      <QuestionCard question={currentQuestion} displayedText={displayed} thinking={thinking} />

      <div className="rounded-2xl border border-line-strong bg-surface shadow-card transition focus-within:border-brand-400/60 focus-within:ring-4 focus-within:ring-brand-500/10">
        <label htmlFor="answer" className="sr-only">
          Your answer
        </label>
        <textarea
          id="answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
              e.preventDefault()
              onSubmitNext('answered')
            }
          }}
          rows={8}
          className="block w-full resize-y rounded-t-2xl bg-transparent p-5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-faint"
          placeholder="Type your answer, or press Dictate and speak. Structure helps: situation, what you did, the result."
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <VoiceInput onTranscript={setAnswer} />
          <div className="flex items-center gap-4">
            <TimerPanel interviewStartedAt={interviewStartedAt} questionStartedAt={questionStartedAt} suggestedSeconds={currentQuestion?.estimatedTime || 0} />
            <span className="font-mono text-xs tabular-nums text-ink-faint">{words} words</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={() => onSubmitNext('answered')} disabled={!canSubmit}>
          {thinking ? <Spinner /> : null} Submit answer <IconArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="lg" onClick={() => onSubmitNext('doubtful')} disabled={!canSubmit}>
          Not sure, next
        </Button>
        <Button variant="ghost" size="lg" onClick={() => onSubmitNext('skipped')} disabled={thinking}>
          Skip
        </Button>
        <span className="ml-auto hidden text-xs text-ink-faint md:inline">
          <kbd className="rounded border border-line-strong px-1.5 py-0.5 font-mono">⌘/Ctrl</kbd> +{' '}
          <kbd className="rounded border border-line-strong px-1.5 py-0.5 font-mono">Enter</kbd> to submit
        </span>
      </div>
    </div>
  )

  return (
    <>
      <InterviewLayout left={left} right={<InterviewSidebar session={session} currentRoundIndex={currentRoundIndex} lastEvaluation={lastEvaluation} />} />
      <DebugPanel session={session} currentQuestion={currentQuestion} roundIndex={currentRoundIndex} errors={errors} />
    </>
  )
}

export default function StandardInterviewPage() {
  const { resume, user } = useInterview()
  return (
    <InterviewProvider resume={resume} userId={user?.id}>
      <StandardInterviewInner />
    </InterviewProvider>
  )
}

