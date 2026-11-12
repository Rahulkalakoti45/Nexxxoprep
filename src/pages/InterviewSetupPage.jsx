import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useInterview from '../hooks/useInterview.js'
import { getQuestionsFromApi } from '../services/questionService.js'

const roles = ['SDE', 'Backend', 'Frontend', 'Data Analyst', 'Product Manager', 'HR']
const difficulties = ['Easy', 'Medium', 'Hard']
const companies = ['Amazon', 'Google', 'Microsoft', 'TCS', 'Infosys', 'Wipro', 'General']
const modes = [
  { label: 'Standard (Text-Based)', value: 'standard' },
  { label: 'AI Simulated (Coming Soon)', value: 'ai_simulated', disabled: true },
]

export default function InterviewSetupPage() {
  const navigate = useNavigate()
  const {
    setInterviewConfig,
    setQuestionRounds,
    setQuestions,
    setAnswers,
    setCurrentQuestionIndex,
    setCurrentInterview,
    resetInterviewSession,
  } = useInterview()

  const [form, setForm] = useState({
    role: 'SDE',
    difficulty: 'Medium',
    company: 'Amazon',
    mode: 'standard',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleStart = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const fetched = await getQuestionsFromApi(form)
      const session = fetched?.session
      if (!session?.questions?.length) throw new Error('Failed to generate interview. Please retry.')

      resetInterviewSession()
      setInterviewConfig(form)
      setQuestionRounds(session.rounds)
      setQuestions(session.questions)
      setAnswers([])
      setCurrentQuestionIndex(session.currentQuestionIndex)
      setCurrentInterview(session)
      setTimeout(() => navigate('/interview'), 0)
    } catch (err) {
      setError(err.message || 'Failed to prepare interview. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-2xl font-semibold">Interview Setup</h2>
      <p className="mt-2 text-ink-muted">Choose your interview configuration to generate relevant question sets.</p>

      <form className="mt-6 grid grid-cols-3 gap-4" onSubmit={handleStart}>
        <label className="col-span-3 block">
          <span className="text-sm text-ink-soft">Interview Mode</span>
          <div className="mt-2 flex gap-2">
            {modes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                disabled={mode.disabled}
                onClick={() => onChange('mode', mode.value)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  form.mode === mode.value
                    ? 'border-brand-400/70 bg-brand-500/15 text-ink shadow-glow'
                    : 'border-line-strong bg-inset text-ink hover:bg-white/10'
                } ${mode.disabled ? 'cursor-not-allowed opacity-50 hover:bg-inset' : ''}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="text-sm text-ink-soft">Role</span>
          <select
            value={form.role}
            onChange={(event) => onChange('role', event.target.value)}
            className="mt-2 w-full rounded-lg border border-line-strong bg-inset px-3 py-2"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-ink-soft">Difficulty</span>
          <select
            value={form.difficulty}
            onChange={(event) => onChange('difficulty', event.target.value)}
            className="mt-2 w-full rounded-lg border border-line-strong bg-inset px-3 py-2"
          >
            {difficulties.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-ink-soft">Company</span>
          <select
            value={form.company}
            onChange={(event) => onChange('company', event.target.value)}
            className="mt-2 w-full rounded-lg border border-line-strong bg-inset px-3 py-2"
          >
            {companies.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
        </label>

        <div className="col-span-3 mt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-400 transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Preparing Interview...' : 'Start Interview'}
          </button>
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        </div>
      </form>
    </section>
  )
}
