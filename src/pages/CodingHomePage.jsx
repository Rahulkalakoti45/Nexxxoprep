import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LANGUAGES, PROBLEMS } from '../features/coding/problems.js'
import { listCodingAttempts } from '../features/coding/interviewer.js'
import { loadAttempts } from '../features/coding/attemptSync.js'
import useInterview from '../hooks/useInterview.js'
import { Badge, Button, Card, CardHeader, PageHeader, ScoreRing, Segmented } from '../components/ui/index.jsx'
import { cx, scoreTone } from '../components/ui/helpers.js'
import { IconArrowRight, IconCheck, IconMic, IconTarget } from '../components/ui/icons.jsx'

const DIFFICULTY_TONE = { Easy: 'good', Medium: 'warn', Hard: 'bad' }

const HOW_IT_WORKS = [
  { title: 'Explain first', body: 'Talk through your approach. The interviewer probes complexity and edge cases, like a real round.' },
  { title: 'Code and run', body: 'Write real code and run it against the examples. The interviewer reacts to what fails.' },
  { title: 'Submit and defend', body: 'Hidden tests run, including large inputs. Then explain your final complexity.' },
]

export default function CodingHomePage() {
  const navigate = useNavigate()
  const { user } = useInterview()
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem('nexoprep_coding_language') || 'javascript'
    } catch {
      return 'javascript'
    }
  })
  const [attempts, setAttempts] = useState(() => listCodingAttempts())
  const [online, setOnline] = useState(null)

  // Upload anything finished offline, then show the full history from every device.
  useEffect(() => {
    let cancelled = false
    loadAttempts(user?.id).then((result) => {
      if (cancelled) return
      setAttempts(result.attempts)
      setOnline(result.online)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])
  const bestByProblem = {}
  for (const a of attempts) bestByProblem[a.problemId] = Math.max(bestByProblem[a.problemId] ?? 0, a.evaluation?.overall ?? 0)

  const start = (problemId) => {
    try {
      localStorage.setItem('nexoprep_coding_language', language)
    } catch {
      // Remembering the language is a convenience only.
    }
    navigate(`/coding/${problemId}?lang=${language}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coding round"
        title="Code with an AI interviewer watching"
        subtitle="Like the AI coding screens companies now use: explain your approach, write real code, pass hidden tests, and defend your complexity. Then see exactly what to improve."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {HOW_IT_WORKS.map((step, i) => (
          <div key={step.title} className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-mono text-xs text-brand-300">0{i + 1}</p>
            <p className="mt-1 font-semibold text-ink">{step.title}</p>
            <p className="mt-1 text-sm text-ink-muted">{step.body}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Pick a problem"
          subtitle="Each takes 20–40 minutes."
          action={
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-muted">Language</span>
              <Segmented label="Language" size="sm" options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))} value={language} onChange={setLanguage} />
            </div>
          }
        />
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {PROBLEMS.map((problem) => {
            const best = bestByProblem[problem.id]
            return (
              <li key={problem.id}>
                <button
                  type="button"
                  onClick={() => start(problem.id)}
                  className="group flex h-full w-full items-start gap-4 rounded-2xl border border-line bg-inset/60 p-4 text-left transition hover:border-brand-400/50 hover:bg-brand-500/[0.05]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{problem.title}</p>
                      <Badge tone={DIFFICULTY_TONE[problem.difficulty]}>{problem.difficulty}</Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-ink-muted">{problem.topics.join(' · ')}</p>
                  </div>
                  {best !== undefined ? (
                    <div className="flex flex-col items-center gap-1">
                      <ScoreRing score={best} size={40} stroke={4} />
                      <span className="text-[10px] text-ink-faint">best</span>
                    </div>
                  ) : (
                    <IconArrowRight className="mt-1 h-4 w-4 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-brand-300" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      {attempts.length ? (
        <Card>
          <CardHeader title="Your recent attempts" subtitle={online === false ? "Showing this device only. They'll sync when the server is reachable." : 'Saved to your account.'} />
          <ul className="mt-4 space-y-2">
            {attempts.slice(0, 6).map((a) => (
              <li key={a.id}>
                <Link to={`/coding/result/${a.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-inset/60 px-3.5 py-2.5 transition hover:border-line-strong">
                  <ScoreRing score={a.evaluation?.overall ?? 0} size={36} stroke={4} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{a.problemTitle}</p>
                    <p className="text-xs text-ink-muted">
                      {new Date(a.finishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {a.languageLabel} · {a.finalRun.passed}/{a.finalRun.total} tests
                    </p>
                  </div>
                  <Badge tone={scoreTone(a.evaluation?.overall ?? 0)}>{a.evaluation?.verdict === 'strong' ? 'Strong' : a.evaluation?.verdict === 'okay' ? 'Okay' : 'Needs work'}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className={cx('flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4')}>
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <IconTarget className="h-4 w-4 text-brand-300" /> Prefer a spoken interview about your resume and projects?
        </p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/setup')}>
          <IconMic className="h-4 w-4" /> Voice interview
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-ink-faint">
        <IconCheck className="h-3.5 w-3.5" /> Tests run in your browser. The AI interviewer reads your code and messages to respond. Python downloads once (about 10 MB) the first time you use it.
      </p>
    </div>
  )
}
