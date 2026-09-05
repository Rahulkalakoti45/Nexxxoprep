import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCandidates,
  getDashboardSummary,
  getStatusBreakdown,
  getTimeline,
} from "../lib/api";
import type {
  CandidateRow,
  DashboardSummary,
  StatusBreakdownItem,
  TimelineEvent,
} from "../types/dashboard";

const REFRESH_MS = 15_000;

export function useDashboardData() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [breakdown, setBreakdown] = useState<StatusBreakdownItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      const [summaryData, breakdownData, candidatesData, timelineData] = await Promise.all([
        getDashboardSummary(),
        getStatusBreakdown(),
        getCandidates({ search, status }),
        getTimeline(),
      ]);
      setSummary(summaryData);
      setBreakdown(breakdownData.items);
      setCandidates(candidatesData.items);
      setTimeline(timelineData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const linksOpened = useMemo(
    () => timeline.filter((event) => event.event_type === "link_opened").length,
    [timeline],
  );

  const expiredSessions = useMemo(() => {
    const now = Date.now();
    return candidates.filter((candidate) => {
      if (!candidate.interview_expires_at) return false;
      const expired = new Date(candidate.interview_expires_at).getTime() < now;
      const terminal = ["INTERVIEW_COMPLETED", "FINAL_SELECTED", "REJECTED"].includes(
        candidate.candidate_status,
      );
      return expired && !terminal;
    }).length;
  }, [candidates]);

  const averageResumeScore = useMemo(() => {
    const scores = candidates
      .map((candidate) => candidate.resume_score)
      .filter((score): score is number => score !== null && score !== undefined);
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
  }, [candidates]);

  const recentActivity = useMemo(() => {
    const allowed = new Set([
      "shortlist_received",
      "email_sent",
      "interview_started",
      "interview_completed",
    ]);
    return timeline.filter((event) => allowed.has(event.event_type)).slice(0, 8);
  }, [timeline]);

  return {
    summary,
    breakdown,
    candidates,
    timeline,
    recentActivity,
    loading,
    error,
    refresh: load,
    search,
    setSearch,
    status,
    setStatus,
    linksOpened,
    expiredSessions,
    averageResumeScore,
  };
}
