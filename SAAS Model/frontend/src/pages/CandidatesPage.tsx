import { CandidatesTable } from "../components/CandidatesTable";
import type { useDashboardData } from "../hooks/useDashboardData";

type DashboardData = ReturnType<typeof useDashboardData>;

export function CandidatesPage({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Candidates</h2>
        <p className="text-sm text-muted-foreground">Search, filter, and review all pipeline candidates</p>
      </section>
      <CandidatesTable
        title="All Candidates"
        items={data.candidates}
        loading={data.loading}
        search={data.search}
        status={data.status}
        onSearchChange={data.setSearch}
        onStatusChange={data.setStatus}
      />
    </div>
  );
}
