import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useInterview from '../hooks/useInterview.js'
import { createOrUpdateUser } from '../services/backend/usersApi.js'
import { checkHealth } from '../services/backend/healthApi.js'
import { ApiError } from '../lib/api.js'

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
          : 'Could not reach the backend. Ensure the server is running on port 4000.'
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
    <section className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111620] p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">NexoPrep</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">Sign in</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your profile is saved to the database. Sessions, reports, and analytics sync with the backend.
        </p>

        {backendOk === false && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Backend unreachable at {import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}
          </p>
        )}
        {backendOk === true && (
          <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Backend connected
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm text-slate-300">Full Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => onChange('name', event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c1018] px-3 py-2 text-slate-100 outline-none transition focus:border-slate-300"
              placeholder="Enter your name"
              required
              disabled={loading}
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => onChange('email', event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c1018] px-3 py-2 text-slate-100 outline-none transition focus:border-slate-300"
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">College</span>
            <input
              type="text"
              value={form.college}
              onChange={(event) => onChange('college', event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c1018] px-3 py-2 text-slate-100 outline-none transition focus:border-slate-300"
              placeholder="Your college"
              disabled={loading}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Branch</span>
            <input
              type="text"
              value={form.branch}
              onChange={(event) => onChange('branch', event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c1018] px-3 py-2 text-slate-100 outline-none transition focus:border-slate-300"
              placeholder="CSE, ECE, IT..."
              disabled={loading}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Graduation Year</span>
            <input
              type="number"
              min="2000"
              max="2100"
              value={form.graduationYear}
              onChange={(event) => onChange('graduationYear', event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c1018] px-3 py-2 text-slate-100 outline-none transition focus:border-slate-300"
              placeholder="2027"
              disabled={loading}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Target Role</span>
            <select
              value={form.targetRole}
              onChange={(event) => onChange('targetRole', event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c1018] px-3 py-2 text-slate-100 outline-none transition focus:border-slate-300"
              disabled={loading}
            >
              {['SDE', 'Backend', 'Frontend', 'Data Analyst', 'Product Manager', 'HR'].map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Experience Level</span>
            <select
              value={form.experienceLevel}
              onChange={(event) => onChange('experienceLevel', event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c1018] px-3 py-2 text-slate-100 outline-none transition focus:border-slate-300"
              disabled={loading}
            >
              {['Fresher', 'Intern', '0-1 years', '1-3 years', '3+ years'].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={probeBackend}
            className="w-full rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
          >
            Check backend connection
          </button>
        </form>
      </div>
    </section>
  )
}
