import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useInterview from '../../../hooks/useInterview.js'
import CompanySelector from '../components/setup/CompanySelector'
import DifficultySelector from '../components/setup/DifficultySelector'
import InterviewModeSelector from '../components/setup/InterviewModeSelector'
import RoleSelector from '../components/setup/RoleSelector'
import LoadingScreen from '../components/shared/LoadingScreen'
import { InterviewProvider } from '../context/InterviewContext'
import { useInterviewSession } from '../hooks/useInterviewSession'

function SetupInner() {
  const navigate = useNavigate()
  const { resume, user } = useInterview()
  const { session, actions } = useInterviewSession()

  const defaults = useMemo(
    () => ({
      interviewMode: 'ai_simulated',
      role: user?.targetRole || 'SDE',
      company: 'Amazon',
      difficulty: 'Medium',
    }),
    [user?.targetRole],
  )

  const [form, setForm] = useState(defaults)
  const [starting, setStarting] = useState(false)

  const hasResume = Boolean(resume?.rawText || (Array.isArray(resume?.projects) && resume.projects.length))

  const start = async () => {
    setStarting(true)
    actions.clear()
    try {
      const created = await actions.bootstrap(form, resume)
      if (created) navigate('/interview')
      else setStarting(false)
    } catch {
      setStarting(false)
    }
  }

  if (session && starting) {
    return <LoadingScreen title="Starting interview…" subtitle="Generating company rounds and questions." />
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6 shadow-lg shadow-black/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">NexoPrep</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">Interview Setup</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Configure a realistic company interview flow. Questions progress round-by-round, not randomly.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">Resume integration</p>
            <p className="mt-1 text-sm text-slate-200">{hasResume ? 'Enabled (projects + skills)' : 'Not detected'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
        <p className="text-sm font-semibold text-slate-100">Interview Type</p>
        <p className="mt-1 text-xs text-slate-400">Standard is the current MVP. AI Simulated is visible for the roadmap.</p>
        <div className="mt-4">
          <InterviewModeSelector value={form.interviewMode} onChange={(v) => setForm((p) => ({ ...p, interviewMode: v }))} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#111620] p-6">
          <p className="text-sm font-semibold text-slate-100">Role</p>
          <p className="mt-1 text-xs text-slate-400">Role affects round focus and question style.</p>
          <div className="mt-4">
            <RoleSelector value={form.role} onChange={(v) => setForm((p) => ({ ...p, role: v }))} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111620] p-6">
          <p className="text-sm font-semibold text-slate-100">Company</p>
          <p className="mt-1 text-xs text-slate-400">Company-specific round structure and priorities.</p>
          <div className="mt-4">
            <CompanySelector value={form.company} onChange={(v) => setForm((p) => ({ ...p, company: v }))} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
        <p className="text-sm font-semibold text-slate-100">Difficulty</p>
        <p className="mt-1 text-xs text-slate-400">Affects question depth and follow-up intensity.</p>
        <div className="mt-4 max-w-sm">
          <DifficultySelector value={form.difficulty} onChange={(v) => setForm((p) => ({ ...p, difficulty: v }))} />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {hasResume ? 'Resume-based questions will be included in Round 1.' : 'Upload resume to enable project/skill questions.'}
          </div>
          <button
            type="button"
            onClick={start}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:opacity-90"
          >
            {form.interviewMode === 'ai_simulated' ? 'Start Conversational Interview' : 'Start Standard Interview'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default function InterviewSetupPage() {
  const { resume, user } = useInterview()
  return (
    <InterviewProvider resume={resume} userId={user?.id}>
      <SetupInner />
    </InterviewProvider>
  )
}

