import { RecentActivityTimeline } from "../components/RecentActivityTimeline";
import type { useDashboardData } from "../hooks/useDashboardData";

type DashboardData = ReturnType<typeof useDashboardData>;

export function ActivityPage({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Activity</h2>
        <p className="text-sm text-muted-foreground">Full event timeline across the hiring pipeline</p>
      </section>
      <RecentActivityTimeline items={data.timeline} loading={data.loading} />
    </div>
  );
}
