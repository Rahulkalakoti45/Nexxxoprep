import {
  CheckCircle2,
  Clock3,
  Link2,
  Mail,
  MailCheck,
  PlayCircle,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type { TimelineEvent } from "../types/dashboard";
import { formatDateTime } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./ui/skeleton";

const EVENT_ICONS: Record<string, typeof Mail> = {
  shortlist_received: UserCheck,
  email_generated: Mail,
  email_sent: MailCheck,
  link_opened: Link2,
  interview_started: PlayCircle,
  interview_completed: CheckCircle2,
  vishwas_result: Sparkles,
};

export function ActivityTimeline({
  items,
  loading,
}: {
  items: TimelineEvent[];
  loading?: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No activity yet" description="Pipeline events will appear here in real time." />
        ) : (
          <ol className="space-y-4">
            {items.map((event) => {
              const Icon = EVENT_ICONS[event.event_type] ?? Clock3;
              return (
                <li key={event.id} className="flex gap-3 rounded-lg border border-border p-3">
                  <div className="mt-0.5 rounded-full bg-accent p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{event.label}</p>
                      <span className="text-xs text-muted-foreground">{formatDateTime(event.occurred_at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.candidate_name ?? "Unknown candidate"}
                      {event.candidate_email ? ` · ${event.candidate_email}` : ""}
                    </p>
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
