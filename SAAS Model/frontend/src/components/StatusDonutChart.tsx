import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { StatusBreakdownItem } from "../types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./ui/skeleton";

const TARGET_STATUSES = [
  "INVITED",
  "INTERVIEW_STARTED",
  "INTERVIEW_COMPLETED",
  "FINAL_SELECTED",
  "REJECTED",
] as const;

const COLORS = ["#2563eb", "#7c3aed", "#16a34a", "#0891b2", "#dc2626"];

export function StatusDonutChart({
  items,
  loading,
}: {
  items: StatusBreakdownItem[];
  loading?: boolean;
}) {
  const data = TARGET_STATUSES.map((status) => {
    const match = items.find((item) => item.status === status);
    return {
      name: status.replace(/_/g, " "),
      value: match?.count ?? 0,
    };
  }).filter((item) => item.value > 0);

  return (
    <Card className="h-full shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">Status Distribution</CardTitle>
        <p className="text-xs text-muted-foreground">Candidate status breakdown</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="mx-auto h-72 w-72 rounded-full" />
        ) : data.length === 0 ? (
          <EmptyState title="No status data" description="Status distribution appears after intake." />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={96}
                  paddingAngle={3}
                >
                  {data.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid w-full grid-cols-1 gap-2">
              {data.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {item.name}
                  </span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
