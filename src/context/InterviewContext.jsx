import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { getUserReports } from '../services/backend/reportsApi.js'
import { getLatestResumeAnalysis } from '../services/backend/resumeApi.js'
import { mapBackendReportsList } from '../utils/reportMapper.js'
import { useRealtime } from '../hooks/useRealtime.js'

const InterviewContext = createContext(null)
const STORAGE_KEY = 'nexoprep_state_v2'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
}

function stripInterviewFields(state) {
  if (!state || typeof state !== 'object') return state
  return {
    ...state,
    interviewConfig: null,
    questionRounds: [],
    questions: [],
    answers: [],
    currentQuestionIndex: 0,
    currentInterview: null,
  }
}

function normalizeReport(report) {
  return {
    id: report.id || `interview-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: report.createdAt || new Date().toISOString(),
    ...report,
  }
}

function mergeReports(localReports, remoteReports) {
  const byId = new Map()
  for (const report of [...remoteReports, ...localReports]) {
    const key = report.backendReportId || report.id
    if (!byId.has(key)) byId.set(key, report)
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function InterviewProvider({ children }) {
  const initialState = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      const cleaned = stripInterviewFields(asObject(parsed, {}))
      return {
        user: cleaned.user ? asObject(cleaned.user, null) : null,
        resume: cleaned.resume ? asObject(cleaned.resume, null) : null,
        interviewConfig: null,
        questionRounds: [],
        questions: [],
        answers: [],
        currentQuestionIndex: 0,
        currentInterview: null,
        activeReport: cleaned.activeReport ? asObject(cleaned.activeReport, null) : null,
        reports: asArray(cleaned.reports),
      }
    } catch {
      return {
        user: null,
        resume: null,
        interviewConfig: null,
        questionRounds: [],
        questions: [],
        answers: [],
        currentQuestionIndex: 0,
        currentInterview: null,
        activeReport: null,
        reports: [],
      }
    }
  }, [])

  const [user, setUser] = useState(initialState.user)
  const [resume, setResume] = useState(initialState.resume)
  const [interviewConfig, setInterviewConfig] = useState(initialState.interviewConfig)
  const [questionRounds, setQuestionRounds] = useState(initialState.questionRounds)
  const [questions, setQuestions] = useState(initialState.questions)
  const [answers, setAnswers] = useState(initialState.answers)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialState.currentQuestionIndex)
  const [currentInterview, setCurrentInterview] = useState(initialState.currentInterview)
  const [activeReport, setActiveReport] = useState(initialState.activeReport)
  const [reports, setReports] = useState(initialState.reports)
  const [hydrated] = useState(true)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState(null)
  const [backendStatus, setBackendStatus] = useState('unknown')
  const currentRoundIndex = null

  const refreshReports = useCallback(async (userId) => {
    const id = userId || user?.id
    if (!id) return
    setReportsLoading(true)
    setReportsError(null)
    try {
      const remote = await getUserReports(id)
      const mapped = mapBackendReportsList(remote)
      setReports((prev) => mergeReports(prev, mapped))
      setBackendStatus('connected')
    } catch (error) {
      setReportsError(error.message || 'Failed to load reports')
      setBackendStatus('error')
    } finally {
      setReportsLoading(false)
    }
  }, [user?.id])

  useRealtime(user?.id, (event) => {
    if (event?.type === 'REPORT_UPDATED') {
      refreshReports(event.payload?.userId)
    }
  })

  useEffect(() => {
    if (!hydrated) return
    const state = {
      user,
      resume,
      interviewConfig: null,
      questionRounds: [],
      questions: [],
      answers: [],
      currentQuestionIndex: 0,
      currentInterview: null,
      activeReport,
      reports,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [activeReport, hydrated, reports, resume, user])

  const refreshResume = useCallback(async (userId) => {
    const id = userId || user?.id
    if (!id) return
    try {
      const analysis = await getLatestResumeAnalysis(id)
      if (!analysis) return
      setResume((prev) => ({
        ...(prev || {}),
        backendAnalysisId: analysis.id,
        extractedAt: analysis.createdAt,
        skills: analysis.extractedSkills || prev?.skills || [],
        rawText: prev?.rawText || '',
        analysis: {
          ...(prev?.analysis || {}),
          resumeScore: analysis.resumeScore,
          atsScore: analysis.atsScore,
          missingSkills: analysis.missingSkills,
          improvementSuggestions: analysis.suggestions,
        },
      }))
    } catch {
      // resume optional
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      refreshReports(user.id)
      refreshResume(user.id)
    }
  }, [user?.id, refreshReports, refreshResume])

  const resetInterviewSession = useCallback(() => {
    setQuestionRounds([])
    setQuestions([])
    setAnswers([])
    setCurrentQuestionIndex(0)
    setCurrentInterview(null)
    setActiveReport(null)
  }, [])

  const addAnswer = useCallback((answer) => {
    setAnswers((prev) => [...prev, answer])
  }, [])

  const saveReport = useCallback((report) => {
    const normalized = normalizeReport(report)
    setActiveReport(normalized)
    setReports((prev) => {
      const next = [normalized, ...prev.filter((r) => r.id !== normalized.id)]
      return next
    })
    if (user?.id) refreshReports(user.id)
    return normalized
  }, [refreshReports, user?.id])

  const logout = useCallback(() => {
    setUser(null)
    setResume(null)
    setInterviewConfig(null)
    resetInterviewSession()
    setReports([])
    setReportsError(null)
    setBackendStatus('unknown')
  }, [resetInterviewSession])

  const value = useMemo(
    () => ({
      user,
      setUser,
      resume,
      setResume,
      interviewConfig,
      setInterviewConfig,
      questionRounds,
      setQuestionRounds,
      questions,
      setQuestions,
      answers,
      setAnswers,
      addAnswer,
      currentQuestionIndex,
      setCurrentQuestionIndex,
      currentInterview,
      setCurrentInterview,
      activeReport,
      saveReport,
      reports,
      reportsLoading,
      reportsError,
      refreshReports,
      backendStatus,
      hydrated,
      resetInterviewSession,
      logout,
    }),
    [
      activeReport,
      addAnswer,
      answers,
      backendStatus,
      currentQuestionIndex,
      currentInterview,
      interviewConfig,
      logout,
      questionRounds,
      questions,
      refreshReports,
      reports,
      reportsError,
      reportsLoading,
      hydrated,
      resetInterviewSession,
      resume,
      saveReport,
      user,
    ],
  )

  return <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>
}

export default InterviewContext
