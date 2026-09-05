import {
  Activity,
  BarChart3,
  FileText,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "../lib/utils";

export type NavItem =
  | "dashboard"
  | "candidates"
  | "activity"
  | "analytics"
  | "reports"
  | "settings";

const NAV_ITEMS: Array<{
  id: NavItem;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "reports", label: "Reports", icon: FileText, badge: "Soon" },
  { id: "settings", label: "Settings", icon: Settings, badge: "Soon" },
];

export function Sidebar({
  active,
  onNavigate,
}: {
  active: NavItem;
  onNavigate: (item: NavItem) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/10 bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">ICD Platform</p>
          <p className="text-xs text-sidebar-muted">Candidate Discovery</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-active text-white shadow-sm"
                  : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="text-xs text-sidebar-muted">Auto-refresh every 15s</p>
        <p className="mt-1 text-xs font-medium text-white/80">Phase 4 Monitor</p>
      </div>
    </aside>
  );
}
