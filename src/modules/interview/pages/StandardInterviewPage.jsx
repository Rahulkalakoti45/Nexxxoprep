import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useInterview from '../../../hooks/useInterview.js'
import { generateInterviewReport } from '../../../services/interviewService.js'
import AIInterviewerCard from '../components/interview/AIInterviewerCard'
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

function DebugPanel({ session, currentQuestion, roundIndex, errors }) {
  if (!import.meta.env.DEV) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-white/10 bg-black/80 p-3 text-xs text-slate-200 backdrop-blur">
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
  const [roundStartedAt, setRoundStartedAt] = useState(Date.now())
  const [lastScore, setLastScore] = useState(null)
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    if (!currentQuestion?.question) return
    setAnswer('')
    setDisplayIndex(0)
    setQuestionStartedAt(Date.now())
  }, [currentQuestion?.id, currentQuestion?.question])

  useEffect(() => {
    setRoundStartedAt(Date.now())
  }, [currentRoundIndex])

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
    return <ErrorState title="Interview failed to load" message={errors[0]} onRetry={() => actions.bootstrap({ resume })} />
  }

  if (!session) {
    return <LoadingScreen title="Loading interview…" subtitle="Restoring a stable session." />
  }

  if (session.interviewMode === 'ai_simulated') {
    return <AISimulatedInterviewPage />
  }

  if (isCompleted) {
    return (
      <section className="mx-auto mt-10 max-w-3xl rounded-2xl border border-white/10 bg-[#111620] p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200">
          Completed
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-slate-100">Session completed</h2>
        <p className="mt-2 text-sm text-slate-400">
          You answered {session.progress.answered} out of {session.progress.total} questions.
        </p>
        <p className="mt-2 text-xs text-slate-400">{reporting ? 'Generating report…' : 'Report will open automatically.'}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              actions.clear()
              navigate('/setup')
            }}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:opacity-90"
          >
            Back to Setup
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="rounded-lg border border-white/15 bg-black/20 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
          >
            Return to Dashboard
          </button>
        </div>
        <DebugPanel session={session} currentQuestion={currentQuestion} roundIndex={currentRoundIndex} errors={errors} />
      </section>
    )
  }

  const onSubmitNext = (statusType = 'answered') => {
    const timeTakenSeconds = (Date.now() - questionStartedAt) / 1000
    const evaluation = actions.submitWithStatus({ answerText: answer, status: statusType, timeTakenSeconds })
    setLastScore(evaluation?.score ?? lastScore)
    setThinking(true)
    setTimeout(() => {
      actions.next()
      setThinking(false)
    }, 360)
  }

  const left = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
        <div>
          <p className="font-semibold text-emerald-100">Live Behavior Analysis & Video Camera Mode Available</p>
          <p className="mt-0.5 text-emerald-300">Click below to launch real-time webcam tracking & AI voice.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            actions.switchMode('ai_simulated')
          }}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white shadow transition hover:bg-emerald-500"
        >
          Switch to Behavior Camera Mode 🎥
        </button>
      </div>
      <AIInterviewerCard company={session.company} role={session.role} isThinking={thinking} />
      <div className="flex items-center justify-between text-xs text-slate-400">
        <p>
          Round {currentRoundIndex + 1}/{session.rounds.length}
        </p>
        <p>
          Question {session.currentQuestionIndex + 1}/{session.questions.length}
        </p>
      </div>
      <QuestionCard question={currentQuestion} displayedText={displayed} />
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={9}
        className="w-full rounded-2xl border border-white/15 bg-[#0a0f17] p-3 text-sm text-slate-100 outline-none transition focus:border-slate-200"
        placeholder="Write your answer here…"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <VoiceInput onTranscript={setAnswer} />
        <TimerPanel
          interviewStartedAt={interviewStartedAt}
          roundStartedAt={roundStartedAt}
          questionStartedAt={questionStartedAt}
          suggestedSeconds={currentQuestion?.estimatedTime || 0}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSubmitNext('answered')}
          disabled={!answer.trim() || thinking}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Submit + Next
        </button>
        <button
          type="button"
          onClick={() => onSubmitNext('doubtful')}
          disabled={!answer.trim() || thinking}
          className="rounded-lg border border-yellow-200/20 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-100 transition hover:bg-yellow-500/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Doubtful + Next
        </button>
        <button
          type="button"
          onClick={() => onSubmitNext('skipped')}
          disabled={thinking}
          className="rounded-lg border border-white/15 bg-black/20 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => {
            actions.clear()
            navigate('/setup')
          }}
          className="rounded-lg border border-red-200/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-500/15"
        >
          End Session
        </button>
      </div>
    </div>
  )

  const right = <InterviewSidebar session={session} currentRoundIndex={currentRoundIndex} currentQuestion={currentQuestion} lastScore={lastScore} />
  const rightWithRoundSelect = (
    <InterviewSidebar
      session={session}
      currentRoundIndex={currentRoundIndex}
      currentQuestion={currentQuestion}
      lastScore={lastScore}
      onSelectRound={(idx) => {
        // view-only: no jumping ahead; allow selecting current or previous rounds to inspect state later.
        if (idx <= currentRoundIndex) return
      }}
    />
  )

  return (
    <>
      <InterviewLayout left={left} right={rightWithRoundSelect} />
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

