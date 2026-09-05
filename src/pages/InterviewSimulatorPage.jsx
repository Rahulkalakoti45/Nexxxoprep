import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useInterview from '../hooks/useInterview.js'
import { useInterviewSession } from '../interview/hooks/useInterviewSession.js'
import InterviewLayout from '../interview/components/InterviewLayout.jsx'
import QuestionCard from '../interview/components/QuestionCard.jsx'
import InterviewSidebar from '../interview/components/InterviewSidebar.jsx'
import VoiceInput from '../interview/components/VoiceInput.jsx'
import { generateInterviewReport } from '../services/interviewService.js'
import { isOpenAIConfigured } from '../services/openaiService.js'

function formatDuration(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function InterviewSimulatorPage() {
  const navigate = useNavigate()
  const {
    interviewConfig,
    setCurrentInterview,
    setQuestions,
    setQuestionRounds,
    setCurrentQuestionIndex,
    answers,
    setAnswers,
    saveReport,
  } = useInterview()
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now())
  const [roundStartedAt, setRoundStartedAt] = useState(() => Date.now())
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [displayedQuestion, setDisplayedQuestion] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [interviewerMessage, setInterviewerMessage] = useState('Let us begin. Answer clearly and with examples.')
  const [speechSupported] = useState(
    typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition),
  )
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [transcript, setTranscript] = useState({ finalText: '', interimText: '' })

  const { session, currentQuestion, progress, submitAnswer, restart } = useInterviewSession({
    company: interviewConfig?.company || 'General',
    role: interviewConfig?.role || 'SDE',
    mode: interviewConfig?.mode || 'standard',
  })

  useEffect(() => {
    setCurrentInterview(session)
    setQuestions(session.questions)
    setQuestionRounds(session.rounds)
    setCurrentQuestionIndex(session.currentQuestionIndex)
  }, [session, setCurrentInterview, setCurrentQuestionIndex, setQuestionRounds, setQuestions])

  useEffect(() => {
    const timer = setInterval(() => {
      setDurationSeconds((p) => p + 1)
      setNowMs(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const questionElapsed = Math.max(0, Math.floor((nowMs - questionStartedAt) / 1000))
  const roundElapsed = Math.max(0, Math.floor((nowMs - roundStartedAt) / 1000))

  useEffect(() => {
    const text = currentQuestion?.question || ''
    let index = 0
    const startDelay = setTimeout(() => {
      setDisplayedQuestion('')
      setIsThinking(true)
      setInterviewerMessage('Analyzing your profile... preparing next prompt.')
      const timer = setInterval(() => {
        index += 1
        setDisplayedQuestion(text.slice(0, index))
        if (index >= text.length) {
          clearInterval(timer)
          setIsThinking(false)
          setInterviewerMessage('Your turn. Keep your answer structured and measurable.')
        }
      }, 12)
    }, 350)
    return () => clearTimeout(startDelay)
  }, [currentQuestion?.id, currentQuestion?.question])

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition || !isListening) return undefined

    const recognition = new SpeechRecognition()
    let mounted = true
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      if (!mounted) return
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript.trim()
        if (!chunk) continue
        if (event.results[i].isFinal) finalText += `${chunk} `
        else interimText += `${chunk} `
      }

      setTranscript((prev) => {
        const merged = `${prev.finalText} ${finalText}`.trim()
        const deduped = merged
          .split(/\s+/)
          .filter((word, idx, arr) => word && (idx === 0 || word !== arr[idx - 1]))
          .join(' ')
        const next = { finalText: deduped.trim(), interimText: interimText.trim() }
        setCurrentAnswer(`${next.finalText} ${next.interimText}`.trim())
        return next
      })
    }

    recognition.onerror = () => {
      if (!mounted) return
      setSpeechError('Mic error occurred. Continue using text input.')
      setIsListening(false)
    }
    recognition.onend = () => {
      if (mounted) setIsListening(false)
    }

    recognition.start()
    return () => {
      mounted = false
      recognition.stop()
    }
  }, [isListening])

  const roundProgress = useMemo(() => {
    const map = {}
    for (const round of session.rounds) {
      const total = round.questions.length
      const done = answers.filter((entry) => entry.question?.roundName === round.roundName).length
      map[round.roundName] = { total, done }
    }
    return map
  }, [answers, session.rounds])

  const domainProgress = useMemo(() => {
    const byDomain = {}
    for (const question of session.questions) {
      const domain = question.domain || 'General'
      if (!byDomain[domain]) byDomain[domain] = { domain, total: 0, answered: 0, doubtful: 0, skipped: 0 }
      byDomain[domain].total += 1
    }
    for (const entry of answers) {
      const domain = entry.question?.domain || 'General'
      if (!byDomain[domain]) byDomain[domain] = { domain, total: 0, answered: 0, doubtful: 0, skipped: 0 }
      if (entry.status === 'skipped') byDomain[domain].skipped += 1
      else if (entry.status === 'doubtful') byDomain[domain].doubtful += 1
      else byDomain[domain].answered += 1
    }
    return Object.values(byDomain)
  }, [answers, session.questions])

  const healthMeter = useMemo(() => {
    if (!answers.length) return 50
    const aggregate = answers.reduce((sum, item) => sum + (item.feedback?.score || 0), 0)
    return Math.max(20, Math.min(98, Math.round(aggregate / answers.length)))
  }, [answers])

  const confidenceMeter = useMemo(() => {
    if (!answers.length) return 45
    const aggregate = answers.reduce((sum, item) => sum + (item.feedback?.confidenceScore || 0), 0)
    return Math.round(aggregate / answers.length)
  }, [answers])

  const paceMeter = useMemo(() => {
    if (!answers.length || !durationSeconds) return 50
    const average = durationSeconds / Math.max(1, answers.length)
    return Math.max(20, Math.min(98, Math.round(100 - Math.abs(80 - average))))
  }, [answers.length, durationSeconds])

  const sparkline = useMemo(() => {
    const values = answers.map((item) => item.feedback?.score || 0)
    return values.length ? values.slice(-8) : [35, 45, 55]
  }, [answers])

  const toggleMic = () => {
    setSpeechError('')
    if (isListening) {
      setIsListening(false)
      setCurrentAnswer(`${transcript.finalText} ${transcript.interimText}`.trim())
      return
    }
    setTranscript({ finalText: '', interimText: '' })
    setIsListening(true)
  }

  const onSubmit = async (status) => {
    if (!currentQuestion) return
    const answerText = currentAnswer.trim()
    if (!answerText && status !== 'skipped') return

    setIsSubmitting(true)
    const entry = submitAnswer(status === 'skipped' ? '' : answerText, status)
    if (!entry) {
      setIsSubmitting(false)
      return
    }
    setAnswers((prev) => [...prev, entry])
    setInterviewerMessage('Processing your response...')
    setQuestionStartedAt(Date.now())
    const nextQuestion = session.questions[session.currentQuestionIndex + 1]
    if (nextQuestion && nextQuestion.roundName !== currentQuestion.roundName) {
      setRoundStartedAt(Date.now())
    }

    const projectedCount = answers.length + 1
    const isComplete = projectedCount >= session.questions.length
    if (isComplete) {
      const report = await generateInterviewReport({
        config: interviewConfig || session,
        answers: [...answers, entry],
        durationSeconds,
        timing: {
          totalSeconds: durationSeconds,
          averageQuestionSeconds: Math.round(durationSeconds / Math.max(1, projectedCount)),
        },
        followUpMetrics: {
          followUpAsked: session.questions.filter((q) => q.isFollowUp).length,
        },
      })
      saveReport(report)
      navigate('/report')
      return
    }

    setCurrentAnswer('')
    setIsSubmitting(false)
  }

  if (!currentQuestion) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
        <h2 className="text-xl font-semibold">Preparing Interview Session...</h2>
        <button
          type="button"
          onClick={restart}
          className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-slate-900"
        >
          Rebuild Session
        </button>
      </section>
    )
  }

  const left = (
    <section className="rounded-2xl border border-white/10 bg-[#111620] p-6 shadow-lg shadow-black/25">
      {!isOpenAIConfigured() ? (
        <div className="mb-4 rounded-xl border border-yellow-300/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          AI fallback mode active (missing VITE_OPENAI_API_KEY).
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Round: {currentQuestion.roundName} - Question {session.currentQuestionIndex + 1} / {session.questions.length}
        </p>
        <p className="text-sm text-slate-300">
          Session: {formatDuration(durationSeconds)} | Round: {formatDuration(roundElapsed)} | Question:{' '}
          {formatDuration(questionElapsed)}
        </p>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-slate-100 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <QuestionCard
        question={currentQuestion}
        company={session.company}
        role={session.role}
        displayedQuestion={displayedQuestion}
        interviewerMessage={interviewerMessage}
        isThinking={isThinking}
      />

      <textarea
        value={currentAnswer}
        onChange={(event) => setCurrentAnswer(event.target.value)}
        rows={9}
        className="mt-4 w-full rounded-xl border border-white/15 bg-[#0a0f17] p-3 text-slate-100 outline-none transition focus:border-slate-200"
        placeholder="Write your answer here..."
      />
      {speechError ? <p className="mt-2 text-xs text-red-300">{speechError}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSubmit('answered')}
          disabled={isSubmitting || !currentAnswer.trim()}
          className="rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:shadow-md hover:shadow-slate-100/10 disabled:opacity-60"
        >
          {isSubmitting ? 'Evaluating...' : 'Next Question'}
        </button>
        <button
          type="button"
          onClick={() => onSubmit('doubtful')}
          disabled={isSubmitting || !currentAnswer.trim()}
          className="rounded-lg border border-yellow-200/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100 transition hover:bg-yellow-500/15 disabled:opacity-60"
        >
          Mark Doubtful + Next
        </button>
        <button
          type="button"
          onClick={() => onSubmit('skipped')}
          disabled={isSubmitting}
          className="rounded-lg border border-red-200/20 bg-red-500/10 px-3 py-2 text-sm text-red-100 transition hover:bg-red-500/15 disabled:opacity-60"
        >
          Skip
        </button>
        <VoiceInput supported={speechSupported} listening={isListening} onToggle={toggleMic} disabled={isSubmitting} />
      </div>
    </section>
  )

  const right = (
    <InterviewSidebar
      rounds={session.rounds}
      roundProgress={roundProgress}
      domainProgress={domainProgress}
      healthMeter={healthMeter}
      confidenceMeter={confidenceMeter}
      paceMeter={paceMeter}
      sparkline={sparkline}
    />
  )

  const debug = import.meta.env.DEV ? (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-lg border border-white/20 bg-black/80 p-3 text-xs text-slate-200 backdrop-blur">
      <p className="font-semibold">Interview Debug</p>
      <p>Loaded: true</p>
      <p>Questions: {session.questions.length}</p>
      <p>Current Index: {session.currentQuestionIndex}</p>
      <p>Current Round: {currentQuestion.roundName}</p>
      <p>Current Question Exists: {String(Boolean(currentQuestion?.question))}</p>
    </div>
  ) : null

  return <InterviewLayout left={left} right={right} debug={debug} />
}
