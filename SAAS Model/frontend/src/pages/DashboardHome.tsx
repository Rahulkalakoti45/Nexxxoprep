import { CheckCircle, MailCheck, Trophy, Users } from "lucide-react";
import { CandidatesTable } from "../components/CandidatesTable";
import { KpiCard } from "../components/KpiCard";
import { PipelineChart } from "../components/PipelineChart";
import { QuickSummaryPanel } from "../components/QuickSummaryPanel";
import { RecentActivityTimeline } from "../components/RecentActivityTimeline";
import { StatusDonutChart } from "../components/StatusDonutChart";
import type { useDashboardData } from "../hooks/useDashboardData";

type DashboardData = ReturnType<typeof useDashboardData>;

export function DashboardHome({ data }: { data: DashboardData }) {
  const { summary, breakdown, candidates, recentActivity, loading } = data;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard Overview</h2>
        <p className="text-sm text-muted-foreground">Monitor your hiring pipeline in real time</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Candidates"
          value={summary?.total_received ?? 0}
          subtitle="Received from Yash"
          trend="+8% this week"
          icon={Users}
          loading={loading}
        />
        <KpiCard
          title="Emails Sent"
          value={summary?.emails_sent ?? 0}
          subtitle="Invitations delivered"
          trend="+5% this week"
          icon={MailCheck}
          loading={loading}
        />
        <KpiCard
          title="Interviews Completed"
          value={summary?.interview_completed ?? 0}
          subtitle="Finished assessments"
          trend="+3% this week"
          icon={CheckCircle}
          loading={loading}
        />
        <KpiCard
          title="Final Selected"
          value={summary?.final_selected ?? 0}
          subtitle="Ready for offer stage"
          trend="Stable"
          icon={Trophy}
          loading={loading}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-10">
        <div className="lg:col-span-7">
          <PipelineChart summary={summary} loading={loading} compact />
        </div>
        <div className="lg:col-span-3">
          <StatusDonutChart items={breakdown} loading={loading} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <RecentActivityTimeline items={recentActivity} loading={loading} compact />
        <QuickSummaryPanel
          summary={summary}
          linksOpened={data.linksOpened}
          expiredSessions={data.expiredSessions}
          averageResumeScore={data.averageResumeScore}
          loading={loading}
        />
      </section>

      <CandidatesTable
        title="Candidates"
        items={candidates}
        loading={loading}
        search={data.search}
        status={data.status}
        onSearchChange={data.setSearch}
        onStatusChange={data.setStatus}
      />
    </div>
  );
}
