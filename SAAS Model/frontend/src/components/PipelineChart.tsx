import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardSummary } from "../types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./ui/skeleton";

export function PipelineChart({
  summary,
  loading,
  compact = false,
}: {
  summary: DashboardSummary | null;
  loading?: boolean;
  compact?: boolean;
}) {
  const data = summary
    ? [
        { stage: "Received", count: summary.total_received },
        { stage: "Shortlisted", count: summary.shortlisted },
        { stage: "Emails Sent", count: summary.emails_sent },
        { stage: "Started", count: summary.interview_started },
        { stage: "Completed", count: summary.interview_completed },
        { stage: "Selected", count: summary.final_selected },
      ]
    : [];

  const height = compact ? 320 : 380;

  return (
    <Card className="h-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">Pipeline Analytics</CardTitle>
        <p className="text-xs text-muted-foreground">End-to-end hiring funnel performance</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className={compact ? "h-80 w-full" : "h-96 w-full"} />
        ) : data.every((item) => item.count === 0) ? (
          <EmptyState title="No pipeline data" description="Ingest candidates to populate analytics." />
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="stage" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                }}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
