import { useEffect, useState } from 'react'
import { getOrchestratorDebug } from '../../../services/backend/conversationApi.js'

export default function InterviewOrchestratorDebugPanel({ sessionId }) {
  const [debug, setDebug] = useState(null)

  useEffect(() => {
    if (!import.meta.env.DEV || !sessionId) return undefined

    let active = true
    const load = async () => {
      try {
        const res = await getOrchestratorDebug(sessionId)
        if (active) setDebug(res.debug)
      } catch {
        if (active) setDebug(null)
      }
    }

    void load()
    const timer = setInterval(() => void load(), 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [sessionId])

  if (!import.meta.env.DEV) return null

  const ctx = debug?.currentPromptContext

  return (
    <div className="fixed bottom-4 right-4 z-50 max-h-80 w-[28rem] overflow-y-auto rounded-xl border border-violet-500/30 bg-black/90 p-3 font-mono text-[10px] text-violet-100 backdrop-blur">
      <p className="mb-2 font-semibold text-violet-300">Interview Orchestrator</p>
      {!debug ? (
        <p className="text-violet-400">Waiting for orchestrator data…</p>
      ) : (
        <>
          <p><span className="text-violet-500">Company:</span> {debug.company || '—'}</p>
          <p><span className="text-violet-500">Role:</span> {debug.role || '—'}</p>
          <p><span className="text-violet-500">Difficulty:</span> {debug.difficulty || '—'}</p>
          <p><span className="text-violet-500">Stage:</span> {debug.currentStage}</p>
          <p><span className="text-violet-500">Questions:</span> {debug.questionCount}</p>
          <p><span className="text-violet-500">First Q pending:</span> {String(debug.firstQuestionPending)}</p>
          <p className="mt-1 break-all"><span className="text-violet-500">Skills:</span> {(ctx?.topSkills || []).join(', ') || '—'}</p>
          <p className="break-all"><span className="text-violet-500">Projects:</span> {(ctx?.projects || []).join('; ') || '—'}</p>
          <p className="break-all"><span className="text-violet-500">Resume summary:</span> {ctx?.resumeSummary?.slice(0, 120) || '—'}</p>
          <p className="mt-1 break-all"><span className="text-violet-500">Prompt context:</span> {JSON.stringify(ctx)}</p>
        </>
      )}
    </div>
  )
}
