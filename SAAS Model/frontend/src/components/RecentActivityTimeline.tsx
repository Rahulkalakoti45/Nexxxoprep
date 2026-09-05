import {
  CheckCircle2,
  Clock3,
  MailCheck,
  UserCheck,
} from "lucide-react";
import type { TimelineEvent } from "../types/dashboard";
import { formatDateTime } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./ui/skeleton";

const EVENT_ICONS: Record<string, typeof MailCheck> = {
  shortlist_received: UserCheck,
  email_sent: MailCheck,
  interview_started: Clock3,
  interview_completed: CheckCircle2,
};

export function RecentActivityTimeline({
  items,
  loading,
  compact = false,
}: {
  items: TimelineEvent[];
  loading?: boolean;
  compact?: boolean;
}) {
  return (
    <Card className="h-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          {compact ? "Recent Activity" : "Activity Timeline"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Latest pipeline events</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: compact ? 4 : 8 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No recent activity" description="Events will appear as candidates progress." />
        ) : (
          <ol className="space-y-3">
            {items.map((event) => {
              const Icon = EVENT_ICONS[event.event_type] ?? Clock3;
              return (
                <li key={event.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <div className="rounded-lg bg-accent p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{event.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.candidate_name ?? "Unknown candidate"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(event.occurred_at)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
