import { Clock3, Link2, Mail, Star, Users } from "lucide-react";
import type { DashboardSummary } from "../types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function QuickSummaryPanel({
  summary,
  linksOpened,
  expiredSessions,
  averageResumeScore,
  loading,
}: {
  summary: DashboardSummary | null;
  linksOpened: number;
  expiredSessions: number;
  averageResumeScore: number;
  loading?: boolean;
}) {
  const rows = [
    { label: "Pending Candidates", value: summary?.pending ?? 0, icon: Users },
    { label: "Emails Queued", value: summary?.emails_queued ?? 0, icon: Mail },
    { label: "Expired Sessions", value: expiredSessions, icon: Clock3 },
    { label: "Links Opened", value: linksOpened, icon: Link2 },
    { label: "Average Resume Score", value: averageResumeScore, icon: Star },
  ];

  return (
    <Card className="h-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">Quick Summary</CardTitle>
        <p className="text-xs text-muted-foreground">Operational snapshot</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-muted-foreground">{row.label}</span>
              </div>
              {loading ? (
                <Skeleton className="h-5 w-10" />
              ) : (
                <span className="text-lg font-semibold">{row.value}</span>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
