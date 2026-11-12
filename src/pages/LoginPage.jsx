import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useInterview from '../hooks/useInterview.js'
import { createOrUpdateUser } from '../services/backend/usersApi.js'
import { checkHealth } from '../services/backend/healthApi.js'
import { ApiError } from '../lib/api.js'
import { Badge, Button, Field, Logo, Segmented, Spinner } from '../components/ui/index.jsx'
import { inputClass } from '../components/ui/helpers.js'
import { IconArrowRight, IconCheck, IconTarget, IconTrendUp, IconUser } from '../components/ui/icons.jsx'

const ROLES = ['SDE', 'Frontend', 'Backend', 'Data Analyst', 'Product Manager', 'HR']
const LEVELS = ['Fresher', 'Intern', '0-1 years', '1-3 years', '3+ years']

const PROMISES = [
  { icon: IconUser, title: 'Interviews built from your resume', body: 'The AI asks about your real projects, then digs deeper like a real interviewer.' },
  { icon: IconTarget, title: 'Feedback you can check', body: 'Every comment points at the exact words you said, with a stronger answer to learn from.' },
  { icon: IconTrendUp, title: 'Weak spots that get fixed', body: 'Your next interview comes back to what you struggled with, until it stops being a weak spot.' },
]

/** A static preview of the answer review, so people see the payoff before signing up. */
function FeedbackPreview() {
  return (
    <div className="relative mt-10 hidden max-w-md lg:block">
      <div className="absolute -inset-6 rounded-[2rem] bg-brand-500/10 blur-2xl" aria-hidden="true" />
      <div className="relative rotate-[-1.2deg] rounded-2xl border border-line-strong bg-raised/90 p-5 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-ink-soft">6:10</span>
          <span className="text-ink-muted">Reliability</span>
          <Badge tone="bad" className="ml-auto">Needs work</Badge>
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">What happens if your server goes down mid-upload?</p>
        <p className="mt-2 rounded-xl bg-inset p-3 text-sm text-ink-soft">
          I&apos;m not sure, I think <mark className="rounded bg-amber-300/20 px-0.5 text-amber-100">the upload would just fail and the user retries</mark>.
        </p>
        <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 text-sm text-ink-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">Stronger answer</p>
          <p className="mt-1">Write the file first, then save the record in a transaction, and retry with an idempotency key so a crash never leaves duplicates…</p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { setUser } = useInterview()
  const [form, setForm] = useState({
    name: '',
    email: '',
    college: '',
    branch: '',
    graduationYear: '',
    targetRole: 'SDE',
    experienceLevel: 'Fresher',
  })
  const [showMore, setShowMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [backendOk, setBackendOk] = useState(null)

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return

    setLoading(true)
    setError(null)

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        college: form.college.trim() || undefined,
        branch: form.branch.trim() || undefined,
        targetRole: form.targetRole,
        experienceLevel: form.experienceLevel,
      }
      if (form.graduationYear) {
        payload.graduationYear = Number(form.graduationYear)
      }

      const user = await createOrUpdateUser(payload)
      setUser({
        id: user.id,
        name: user.name,
        email: user.email,
        college: user.college,
        branch: user.branch,
        graduationYear: user.graduationYear,
        targetRole: user.targetRole || form.targetRole,
        experienceLevel: user.experienceLevel || form.experienceLevel,
        loginAt: new Date().toISOString(),
      })
      navigate('/dashboard')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "We couldn't reach the NexoPrep server. Check that it's running on port 4000, then try again."
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const probeBackend = async () => {
    try {
      await checkHealth()
      setBackendOk(true)
    } catch {
      setBackendOk(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <section className="animate-rise">
          <Logo to="/login" />
          <h1 className="mt-10 text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl lg:text-6xl">
            Walk into your next interview{' '}
            <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-sky-300 bg-clip-text text-transparent">already practised.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-muted">
            A voice interviewer that reads your resume, asks the follow-ups real interviewers ask, and shows you exactly how to answer better.
          </p>

          <ul className="mt-8 grid max-w-lg gap-4">
            {PROMISES.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-400/25 bg-brand-500/10 text-brand-300">
                  <item.icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="font-semibold text-ink">{item.title}</p>
                  <p className="text-sm text-ink-muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <FeedbackPreview />
        </section>

        <section className="animate-rise [animation-delay:120ms]">
          <div className="rounded-3xl border border-line-strong bg-surface/90 p-6 shadow-2xl backdrop-blur sm:p-8">
            <h2 className="text-2xl font-semibold text-ink">Start practising</h2>
            <p className="mt-1.5 text-sm text-ink-muted">Takes 20 seconds. Already have an account? Use the same email to pick up where you left off.</p>

            {error ? (
              <p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-100">
                {error}
              </p>
            ) : null}

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <Field label="Your name">
                <input
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => onChange('name', event.target.value)}
                  className={inputClass}
                  placeholder="Priya Sharma"
                  required
                  disabled={loading}
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => onChange('email', event.target.value)}
                  className={inputClass}
                  placeholder="you@college.edu"
                  required
                  disabled={loading}
                />
              </Field>

              <div>
                <p className="mb-2 text-sm font-medium text-ink-soft">I&apos;m preparing for</p>
                <Segmented label="Target role" size="sm" options={ROLES} value={form.targetRole} onChange={(v) => onChange('targetRole', v)} />
              </div>

              <div className="rounded-2xl border border-line bg-inset/60">
                <button
                  type="button"
                  onClick={() => setShowMore((v) => !v)}
                  aria-expanded={showMore}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-ink-soft"
                >
                  <span>
                    More about you <span className="font-normal text-ink-faint">(optional)</span>
                  </span>
                  <span className={`transition ${showMore ? 'rotate-90' : ''}`} aria-hidden="true">
                    ›
                  </span>
                </button>
                {showMore ? (
                  <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
                    <Field label="College">
                      <input type="text" value={form.college} onChange={(e) => onChange('college', e.target.value)} className={inputClass} placeholder="Your college" disabled={loading} />
                    </Field>
                    <Field label="Branch">
                      <input type="text" value={form.branch} onChange={(e) => onChange('branch', e.target.value)} className={inputClass} placeholder="CSE, ECE, IT…" disabled={loading} />
                    </Field>
                    <Field label="Graduation year">
                      <input
                        type="number"
                        min="2000"
                        max="2100"
                        value={form.graduationYear}
                        onChange={(e) => onChange('graduationYear', e.target.value)}
                        className={inputClass}
                        placeholder="2027"
                        disabled={loading}
                      />
                    </Field>
                    <Field label="Experience">
                      <select value={form.experienceLevel} onChange={(e) => onChange('experienceLevel', e.target.value)} className={inputClass} disabled={loading}>
                        {LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                ) : null}
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner /> Setting things up…
                  </>
                ) : (
                  <>
                    Continue <IconArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-ink-faint">
              <span className="flex items-center gap-1.5">
                <IconCheck className="h-3.5 w-3.5 text-emerald-300" /> No password needed, just your email
              </span>
              <button type="button" onClick={probeBackend} className="underline-offset-4 hover:text-ink-soft hover:underline">
                {backendOk === null ? 'Check server' : backendOk ? 'Server connected ✓' : 'Server unreachable'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
