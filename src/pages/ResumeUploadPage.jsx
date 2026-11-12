import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useInterview from '../hooks/useInterview.js'
import { analyzeResume } from '../utils/resumeAnalyzer.js'
import { analyzeResumeWithAI, optimizeResumeWithAI } from '../services/openaiService.js'
import { analyzeResume as analyzeResumeApi } from '../services/backend/resumeApi.js'
import * as pdfjsLib from 'pdfjs-dist'
import { Badge, Button, ButtonLink, Card, CardHeader, EmptyState, PageHeader, ScoreRing, Spinner } from '../components/ui/index.jsx'
import { cx } from '../components/ui/helpers.js'
import { IconArrowRight, IconCheck, IconFile, IconSparkle, IconUpload } from '../components/ui/icons.jsx'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

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
        const extracted = fullText.trim()
        if (extracted.length < 30) {
          setAiError('This PDF has no selectable text (likely a scanned image). Please paste your resume text manually.')
        } else {
          setResumeText(extracted)
        }
      } catch (err) {
        console.error('[resume-pdf-extract]', err)
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

  const [dragging, setDragging] = useState(false)
  const [showText, setShowText] = useState(false)
  const [copied, setCopied] = useState(false)

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) handleFileChange({ target: { files: [file] } })
  }

  const copyOptimized = async () => {
    try {
      await navigator.clipboard.writeText(optimizedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const companySuggestions = resumeInsights?.companySuggestions || []
  const roleImprovements = resumeInsights?.roleImprovements || resumeInsights?.improvementSuggestions || []
  const missingSkills = resumeInsights?.missingSkills || []
  const hasText = Boolean(resumeText.trim())

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resume"
        title="Make the interview about you"
        subtitle="Add your resume and the interviewer will ask about your real projects and skills, just like a real panel."
        action={
          resume ? (
            <ButtonLink to="/setup" size="md">
              Start an interview <IconArrowRight className="h-4 w-4" />
            </ButtonLink>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="1. Upload your resume" subtitle="PDF works best. We read the text in your browser." />

          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cx(
              'mt-5 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
              dragging ? 'border-brand-400 bg-brand-500/10' : 'border-line-strong bg-inset/60 hover:border-brand-400/60 hover:bg-brand-500/[0.04]',
            )}
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/15 text-brand-300">
              <IconUpload className="h-6 w-6" />
            </span>
            <span className="mt-4 font-semibold text-ink">{selectedFileName || 'Drop your PDF here, or click to browse'}</span>
            <span className="mt-1 text-sm text-ink-muted">
              {selectedFileName ? (hasText ? 'Text extracted. Ready to analyse.' : 'Reading…') : 'One page or two, any template.'}
            </span>
            <input type="file" accept="application/pdf" onChange={handleFileChange} className="sr-only" />
          </label>

          <button
            type="button"
            onClick={() => setShowText((v) => !v)}
            aria-expanded={showText || !selectedFileName}
            className="mt-4 text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {hasText ? (showText ? 'Hide the text we read' : 'Check the text we read') : 'No PDF? Paste your resume text instead'}
          </button>
          {showText || (!hasText && !selectedFileName) ? (
            <textarea
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              rows={8}
              className="mt-3 w-full rounded-xl border border-line-strong bg-inset p-3.5 text-sm leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15"
              placeholder="Paste your resume content here…"
            />
          ) : null}

          {aiError ? (
            <p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-100">
              {aiError}
            </p>
          ) : null}

          <Button size="lg" className="mt-5 w-full" onClick={handleExtract} disabled={loadingAI || !hasText}>
            {loadingAI ? (
              <>
                <Spinner /> Analysing your resume…
              </>
            ) : (
              <>
                <IconSparkle className="h-4 w-4" /> Analyse resume
              </>
            )}
          </Button>
        </Card>

        <Card>
          <CardHeader title="2. What we found" subtitle={`Scored for ${role} roles at ${company}.`} />
          {resumeInsights ? (
            <div className="mt-5 space-y-6">
              <div className="flex flex-wrap justify-around gap-6 rounded-2xl border border-line bg-inset/60 p-5">
                <div className="text-center">
                  <ScoreRing score={resumeInsights.resumeScore ?? null} size={104} stroke={8} />
                  <p className="mt-2 text-sm font-medium text-ink-soft">Resume score</p>
                </div>
                <div className="text-center">
                  <ScoreRing score={resumeInsights.atsScore ?? null} size={104} stroke={8} />
                  <p className="mt-2 text-sm font-medium text-ink-soft">ATS readability</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-ink">Skills worth adding</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {missingSkills.length ? missingSkills.map((skill) => <Badge key={skill}>{skill}</Badge>) : <p className="text-sm text-ink-muted">Nothing obvious missing.</p>}
                </div>
              </div>

              {[
                [`For ${company}`, companySuggestions],
                [`For ${role} roles`, roleImprovements],
              ].map(([title, items]) =>
                items.length ? (
                  <div key={title}>
                    <p className="text-sm font-semibold text-ink">{title}</p>
                    <ul className="mt-2 space-y-2">
                      {items.map((item) => (
                        <li key={item} className="flex gap-2.5 text-sm text-ink-soft">
                          <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState icon={<IconFile />} title="Nothing analysed yet" body="Upload or paste your resume, then hit Analyse. Scores and suggestions show up here." />
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Rewrite it for this role"
          subtitle={`An AI rewrite tuned for ${role} at ${company}. Review every line before you use it.`}
          action={
            <Button variant="secondary" size="sm" onClick={handleOptimize} disabled={loadingAI || !hasText}>
              {loadingAI ? <Spinner /> : <IconSparkle className="h-4 w-4" />} Rewrite
            </Button>
          }
        />
        {optimizedText ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Before</p>
              <textarea value={resumeText} readOnly rows={12} className="w-full rounded-xl border border-line bg-inset p-3.5 text-sm leading-relaxed text-ink-muted" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">After</p>
                <button type="button" onClick={copyOptimized} className="text-xs font-semibold text-brand-300 hover:text-brand-200">
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
              <textarea value={optimizedText} readOnly rows={12} className="w-full rounded-xl border border-brand-400/30 bg-brand-500/[0.05] p-3.5 text-sm leading-relaxed text-ink" />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">{hasText ? 'Hit Rewrite to see a version tuned for this role, side by side with yours.' : 'Add your resume first.'}</p>
        )}
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => navigate('/setup')}>
          Continue to interview setup <IconArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
