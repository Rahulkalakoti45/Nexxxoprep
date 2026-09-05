import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useInterview from '../hooks/useInterview.js'
import { analyzeResume } from '../utils/resumeAnalyzer.js'
import { analyzeResumeWithAI, optimizeResumeWithAI } from '../services/openaiService.js'
import { analyzeResume as analyzeResumeApi } from '../services/backend/resumeApi.js'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

export default function ResumeUploadPage() {
  const navigate = useNavigate()
  const { user, resume, setResume, interviewConfig } = useInterview()
  const [selectedFileName, setSelectedFileName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [resumeText, setResumeText] = useState('')
  const [optimizedText, setOptimizedText] = useState('')
  const [loadingAI, setLoadingAI] = useState(false)
  const [aiError, setAiError] = useState('')

  const role = interviewConfig?.role || 'SDE'
  const company = interviewConfig?.company || 'Amazon'

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSelectedFileName(file.name)
    setSelectedFile(file)
    setAiError('')

    // Auto-extract text from PDF so user doesn't have to paste manually
    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          const pageText = content.items.map((item) => item.str).join(' ')
          fullText += pageText + '\n'
        }
        setResumeText(fullText.trim())
      } catch (err) {
        setAiError('Could not auto-extract PDF text. Please paste your resume text manually.')
      }
    }
  }

  const handleExtract = async () => {
    setLoadingAI(true)
    setAiError('')
    try {
      // Local analysis: extracts skills, missingSkills, projects, experience, score
      const localAnalysis = analyzeResume(resumeText, role)
      // AI analysis: returns atsScore, companySuggestions, roleImprovements, etc.
      const aiAnalysis = await analyzeResumeWithAI({ resumeText, role, company })

      let backendAnalysis = null
      if (user?.id) {
        backendAnalysis = await analyzeResumeApi(user.id, {
          resumeText,
          targetRole: role,
          company,
        })
      }

      const structuredResume = {
        uploadedFileName: selectedFileName || 'resume.pdf',
        extractedAt: new Date().toISOString(),
        skills: backendAnalysis?.extractedSkills || localAnalysis.skills,
        projects: localAnalysis.projects,
        experience: localAnalysis.experience,
        rawText: resumeText,
        backendAnalysisId: backendAnalysis?.id,
        analysis: {
          ...localAnalysis,
          ...aiAnalysis,
          resumeScore: backendAnalysis?.resumeScore ?? localAnalysis.resumeScore,
          atsScore: backendAnalysis?.atsScore ?? aiAnalysis.atsScore,
          missingSkills: backendAnalysis?.missingSkills || localAnalysis.missingSkills,
          improvementSuggestions: backendAnalysis?.suggestions || localAnalysis.improvementSuggestions,
        },
      }
      setResume(structuredResume)
    } catch (error) {
      setAiError(error.message || 'Failed to analyze resume.')
    } finally {
      setLoadingAI(false)
    }
  }

  const resumeInsights = useMemo(() => {
    return resume?.analysis || (resumeText ? analyzeResume(resumeText, role) : null)
  }, [resume?.analysis, resumeText, role])

  const handleOptimize = async () => {
    setLoadingAI(true)
    setAiError('')
    try {
      const optimized = await optimizeResumeWithAI({ resumeText, role, company })
      setOptimizedText(optimized.optimizedResume || '')
    } catch (error) {
      setAiError(error.message || 'Failed to optimize resume.')
    } finally {
      setLoadingAI(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#111620] p-6">
        <h2 className="text-2xl font-semibold">Resume Upload</h2>
        <p className="mt-2 text-slate-400">Upload your PDF and run AI-powered resume analysis and optimization.</p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-dashed border-white/20 bg-black/20 p-5">
            <p className="text-sm text-slate-300">Upload PDF</p>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="mt-3 block w-full rounded-lg border border-white/10 bg-[#0a0e15] px-3 py-2 text-sm"
            />
            <p className="mt-2 text-xs text-slate-400">Selected: {selectedFileName || 'No file selected'}</p>

            <div className="mt-5">
              <p className="text-sm text-slate-300">Paste resume text (required for AI analysis)</p>
              <textarea
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                rows={8}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#0a0f17] p-3 text-sm text-slate-100 outline-none transition focus:border-slate-200"
                placeholder="Paste your resume content here..."
              />
            </div>

            <button
              type="button"
              onClick={handleExtract}
              disabled={loadingAI || !resumeText.trim()}
              className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:opacity-90 disabled:opacity-60"
            >
              {loadingAI ? 'Analyzing...' : 'Analyze Resume'}
            </button>
            {aiError ? <p className="mt-2 text-sm text-red-300">{aiError}</p> : null}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm text-slate-300">AI Resume Insights</p>
            {resumeInsights ? (
              <div className="mt-3 space-y-3 text-sm text-slate-300">
                <div className="rounded-xl border border-white/10 bg-[#0a0f17] p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Resume Score / ATS</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-100">
                    {resumeInsights.resumeScore ?? '--'}% / {resumeInsights.atsScore ?? '--'}%
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-100">Missing Skills</p>
                  <p>{resumeInsights.missingSkills?.join(', ') || '--'}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-100">Company Suggestions ({company})</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {(resumeInsights.companySuggestions || []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-100">Role Improvements ({role})</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {(resumeInsights.roleImprovements || resumeInsights.improvementSuggestions || []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-slate-400">No structured resume data yet.</p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Optimize Resume (AI)</h3>
              <button
                type="button"
                onClick={handleOptimize}
                disabled={loadingAI || !resumeText.trim()}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
              >
                {loadingAI ? 'Optimizing...' : 'Optimize'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">Target: {company} • {role}</p>
            <textarea
              value={resumeText}
              readOnly
              rows={8}
              className="mt-3 w-full rounded-xl border border-white/10 bg-[#0a0f17] p-3 text-sm text-slate-200"
              placeholder="Original resume text"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
            <h3 className="text-lg font-semibold">After Optimization</h3>
            <textarea
              value={optimizedText}
              readOnly
              rows={8}
              className="mt-3 w-full rounded-xl border border-white/10 bg-[#0a0f17] p-3 text-sm text-slate-200"
              placeholder="AI optimized resume will appear here..."
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/setup')}
        className="rounded-lg border border-white/20 px-4 py-2 transition hover:bg-white/10"
      >
        Continue to Interview Setup
      </button>
    </section>
  )
}

