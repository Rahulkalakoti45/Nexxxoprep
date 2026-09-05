import { PipelineChart } from "../components/PipelineChart";
import { QuickSummaryPanel } from "../components/QuickSummaryPanel";
import { StatusDonutChart } from "../components/StatusDonutChart";
import type { useDashboardData } from "../hooks/useDashboardData";

type DashboardData = ReturnType<typeof useDashboardData>;

export function AnalyticsPage({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground">Pipeline funnel and candidate status insights</p>
      </section>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PipelineChart summary={data.summary} loading={data.loading} />
        </div>
        <StatusDonutChart items={data.breakdown} loading={data.loading} />
      </div>
      <QuickSummaryPanel
        summary={data.summary}
        linksOpened={data.linksOpened}
        expiredSessions={data.expiredSessions}
        averageResumeScore={data.averageResumeScore}
        loading={data.loading}
      />
    </div>
  );
}
