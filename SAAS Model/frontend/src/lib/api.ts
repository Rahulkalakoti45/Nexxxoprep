import type {
  CandidateRow,
  DashboardSummary,
  StatusBreakdownItem,
  TimelineEvent,
} from "../types/dashboard";

const API_BASE = "/api/v1/dashboard";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return fetchJson(`${API_BASE}/summary`);
}

export async function getStatusBreakdown(): Promise<{ items: StatusBreakdownItem[] }> {
  return fetchJson(`${API_BASE}/status-breakdown`);
}

export async function getCandidates(params: {
  search?: string;
  status?: string;
}): Promise<{ total: number; items: CandidateRow[] }> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchJson(`${API_BASE}/candidates${suffix}`);
}

export async function getTimeline(): Promise<{ items: TimelineEvent[] }> {
  return fetchJson(`${API_BASE}/timeline`);
}
