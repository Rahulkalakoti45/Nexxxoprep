import { useEffect, useMemo, useState } from 'react'
import AIInterviewerCard from '../components/AIInterviewerCard'
import InterviewLayout from '../components/InterviewLayout'
import InterviewSidebar from '../components/InterviewSidebar'
import QuestionCard from '../components/QuestionCard'
import TimerPanel from '../components/TimerPanel'
import VoiceInput from '../components/VoiceInput'
import { InterviewV2Provider } from '../context/InterviewV2Context'
import { useInterviewSession } from '../hooks/useInterviewSession'

const SAFE_TEST_CONFIG = {
  company: 'amazon',
  role: 'SDE',
}

function DebugPanel({ state }) {
  if (import.meta.env.PROD) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-100 shadow-xl">
      <p>session loaded: {String(Boolean(state.sessionId))}</p>
      <p>questions count: {state.questions.length}</p>
      <p>current round: {state.currentRoundIndex + 1}</p>
      <p>current question index: {state.currentQuestionIndex}</p>
      <p>active company: {state.company || 'n/a'}</p>
      <p>errors detected: {state.errors.length}</p>
    </div>
  )
}

function InterviewV2Content() {
  const { state, currentQuestion, actions } = useInterviewSession()
  const [answer, setAnswer] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [typingIndex, setTypingIndex] = useState(0)

  useEffect(() => {
    if (!currentQuestion?.question) return
    setTypingIndex(0)
  }, [currentQuestion?.id, currentQuestion?.question])

  useEffect(() => {
    if (!currentQuestion?.question) return undefined
    const fullText = currentQuestion.question
    if (typingIndex >= fullText.length) return undefined
    const timer = setTimeout(() => {
      setTypingIndex((prev) => Math.min(prev + 2, fullText.length))
    }, 14)
    return () => clearTimeout(timer)
  }, [currentQuestion?.question, typingIndex])

  const displayedQuestion = useMemo(() => {
    if (!currentQuestion?.question) return ''
    return currentQuestion.question.slice(0, typingIndex)
  }, [currentQuestion?.question, typingIndex])

  if (state.status === 'completed' || state.currentQuestionIndex >= state.questions.length) {
    return (
      <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h1 className="text-2xl font-semibold text-emerald-900">Interview V2 completed</h1>
        <p className="mt-2 text-sm text-emerald-800">
          You finished {state.progress.answered} answers across {state.progress.total} questions.
        </p>
        <button
          type="button"
          onClick={() => {
            actions.resetInterview()
            actions.bootstrapSession(SAFE_TEST_CONFIG)
          }}
          className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
        >
          Restart Test Session
        </button>
        <DebugPanel state={state} />
      </div>
    )
  }

  return (
    <>
      <InterviewLayout
        left={
          <div className="space-y-4">
            <AIInterviewerCard company={state.company} isThinking={isThinking} />
            <QuestionCard question={currentQuestion} displayedText={displayedQuestion} />
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Type your answer here..."
              className="min-h-36 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-indigo-400 focus:outline-none"
            />
            <VoiceInput onTranscript={setAnswer} />
            <TimerPanel startedAt={state.startedAt} estimatedTime={currentQuestion?.estimatedTime || 0} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  actions.submitAnswer(answer)
                  setIsThinking(true)
                  setTimeout(() => {
                    actions.nextQuestion()
                    setAnswer('')
                    setIsThinking(false)
                  }, 380)
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
              >
                Submit + Next
              </button>
              <button
                type="button"
                onClick={() => {
                  actions.skipQuestion()
                  setAnswer('')
                }}
                className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => actions.finishInterview()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white"
              >
                Finish
              </button>
            </div>
          </div>
        }
        right={<InterviewSidebar state={state} currentQuestion={currentQuestion} />}
      />
      <DebugPanel state={state} />
    </>
  )
}

export default function InterviewV2Page() {
  return (
    <InterviewV2Provider initialConfig={SAFE_TEST_CONFIG}>
      <InterviewV2Content />
    </InterviewV2Provider>
  )
}
