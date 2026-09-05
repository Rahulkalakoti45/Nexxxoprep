import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  trend: string;
  icon: LucideIcon;
  loading?: boolean;
}) {
  return (
    <Card className="overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-xl bg-accent p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </span>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="mt-2 h-9 w-20" />
          ) : (
            <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}
