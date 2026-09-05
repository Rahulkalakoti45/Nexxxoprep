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
    <section className="rounded-2xl border border-white/10 bg-[#111620] p-6">
      <h2 className="text-2xl font-semibold">Interview Setup</h2>
      <p className="mt-2 text-slate-400">Choose your interview configuration to generate relevant question sets.</p>

      <form className="mt-6 grid grid-cols-3 gap-4" onSubmit={handleStart}>
        <label className="col-span-3 block">
          <span className="text-sm text-slate-300">Interview Mode</span>
          <div className="mt-2 flex gap-2">
            {modes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                disabled={mode.disabled}
                onClick={() => onChange('mode', mode.value)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  form.mode === mode.value
                    ? 'border-slate-200 bg-slate-100 text-slate-900'
                    : 'border-white/15 bg-black/20 text-slate-200 hover:bg-white/10'
                } ${mode.disabled ? 'cursor-not-allowed opacity-50 hover:bg-black/20' : ''}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Role</span>
          <select
            value={form.role}
            onChange={(event) => onChange('role', event.target.value)}
            className="mt-2 w-full rounded-lg border border-white/15 bg-[#0b0f17] px-3 py-2"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Difficulty</span>
          <select
            value={form.difficulty}
            onChange={(event) => onChange('difficulty', event.target.value)}
            className="mt-2 w-full rounded-lg border border-white/15 bg-[#0b0f17] px-3 py-2"
          >
            {difficulties.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-slate-300">Company</span>
          <select
            value={form.company}
            onChange={(event) => onChange('company', event.target.value)}
            className="mt-2 w-full rounded-lg border border-white/15 bg-[#0b0f17] px-3 py-2"
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
            className="rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Preparing Interview...' : 'Start Interview'}
          </button>
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        </div>
      </form>
    </section>
  )
}
