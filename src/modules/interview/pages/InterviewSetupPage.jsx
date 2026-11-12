import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useInterview from '../../../hooks/useInterview.js'
import CompanySelector from '../components/setup/CompanySelector'
import DifficultySelector from '../components/setup/DifficultySelector'
import InterviewModeSelector from '../components/setup/InterviewModeSelector'
import RoleSelector from '../components/setup/RoleSelector'
import LoadingScreen from '../components/shared/LoadingScreen'
import { InterviewProvider } from '../context/InterviewContext'
import { useInterviewSession } from '../hooks/useInterviewSession'
import { Button, Card, PageHeader, Spinner } from '../../../components/ui/index.jsx'
import { IconArrowRight, IconCheck, IconFile, IconMic } from '../../../components/ui/icons.jsx'

// Sign-up offers short role names; setup uses the full ones.
const ROLE_ALIASES = { Frontend: 'Frontend Developer', Backend: 'Backend Developer' }

function Step({ number, title, hint, children }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line-strong font-mono text-xs text-ink-muted">{number}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-base font-semibold text-ink">{title}</h3>
          {hint ? <p className="mt-0.5 text-sm text-ink-muted">{hint}</p> : null}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  )
}

function SetupInner() {
  const navigate = useNavigate()
  const { resume, user } = useInterview()
  const { session, actions } = useInterviewSession()

  const defaults = useMemo(
    () => ({
      interviewMode: 'ai_simulated',
      role: ROLE_ALIASES[user?.targetRole] || user?.targetRole || 'SDE',
      company: 'Amazon',
      difficulty: 'Medium',
    }),
    [user?.targetRole],
  )

  const [form, setForm] = useState(defaults)
  const [starting, setStarting] = useState(false)
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }))

  const hasResume = Boolean(resume?.rawText || (Array.isArray(resume?.projects) && resume.projects.length))
  const isVoice = form.interviewMode === 'ai_simulated'

  const isCoding = form.interviewMode === 'coding'

  const start = async () => {
    // The coding round has its own problem picker.
    if (isCoding) {
      navigate('/coding')
      return
    }
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
    return <LoadingScreen title="Setting up your interview…" subtitle="Reading your resume and planning the rounds." />
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="New interview" title="Set up your practice" subtitle="Pick the job you're preparing for. The interviewer adapts its questions, follow-ups and difficulty to it." />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Step number={1} title="How do you want to practise?">
            <InterviewModeSelector value={form.interviewMode} onChange={set('interviewMode')} />
          </Step>
          {isCoding ? null : (
            <>
          <Step number={2} title="Role" hint="Shapes which topics and rounds you get.">
            <RoleSelector value={form.role} onChange={set('role')} />
          </Step>
          <Step number={3} title="Company" hint="Uses that company's round structure and priorities.">
            <CompanySelector value={form.company} onChange={set('company')} />
          </Step>
          <Step number={4} title="Difficulty" hint="Controls how deep the follow-up questions go.">
            <DifficultySelector value={form.difficulty} onChange={set('difficulty')} />
          </Step>
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="border-line-strong">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">Your interview</p>
            <p className="mt-2 font-display text-xl font-semibold text-ink">
              {isCoding ? 'Coding round' : `${form.role} at ${form.company}`}
            </p>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Format</dt>
                <dd className="text-ink">{isCoding ? 'Editor + AI interviewer' : isVoice ? 'Voice conversation' : 'Structured rounds'}</dd>
              </div>
              {isCoding ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Languages</dt>
                  <dd className="text-ink">JavaScript, Python</dd>
                </div>
              ) : (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Difficulty</dt>
                    <dd className="text-ink">{form.difficulty}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Rounds</dt>
                    <dd className="text-right text-ink">Resume · Technical · Behavioral</dd>
                  </div>
                </>
              )}
            </dl>

            {isCoding ? null : (
            <div className={`mt-5 flex gap-2.5 rounded-xl border p-3 text-sm ${hasResume ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : 'border-amber-400/25 bg-amber-400/[0.06]'}`}>
              {hasResume ? <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> : <IconFile className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />}
              <p className="text-ink-soft">
                {hasResume ? (
                  'Your resume is loaded. Expect questions about your own projects.'
                ) : (
                  <>
                    No resume yet, so questions will be general.{' '}
                    <Link to="/resume" className="font-semibold text-amber-200 underline-offset-4 hover:underline">
                      Add it
                    </Link>
                  </>
                )}
              </p>
            </div>
            )}

            <Button size="lg" className="mt-5 w-full" onClick={start} disabled={starting}>
              {starting ? (
                <>
                  <Spinner /> Starting…
                </>
              ) : (
                <>
                  {isCoding ? 'Choose a problem' : (
                    <>
                      <IconMic className="h-4 w-4" /> Start interview
                    </>
                  )}{' '}
                  <IconArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            {isVoice && !isCoding ? <p className="mt-3 text-center text-xs text-ink-faint">You&apos;ll be asked for microphone access. Find a quiet spot.</p> : null}
          </Card>
        </aside>
      </div>
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
