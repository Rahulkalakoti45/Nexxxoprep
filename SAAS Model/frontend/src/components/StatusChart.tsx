import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatusBreakdownItem } from "../types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./ui/skeleton";

export function StatusChart({
  items,
  loading,
}: {
  items: StatusBreakdownItem[];
  loading?: boolean;
}) {
  const data = items.map((item) => ({
    status: item.status.replace(/_/g, " "),
    count: item.count,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Status Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : data.length === 0 ? (
          <EmptyState title="No status data" description="Shortlist candidates to see breakdown." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
