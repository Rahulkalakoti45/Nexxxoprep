import type { ReactNode } from "react";
import { Sidebar, type NavItem } from "./Sidebar";
import { TopNav } from "./TopNav";

export function DashboardLayout({
  activeNav,
  onNavigate,
  search,
  onSearchChange,
  onRefresh,
  loading,
  children,
}: {
  activeNav: NavItem;
  onNavigate: (item: NavItem) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar active={activeNav} onNavigate={onNavigate} />
      <div className="min-h-screen pl-0 md:pl-64">
        <TopNav
          search={search}
          onSearchChange={onSearchChange}
          onRefresh={onRefresh}
          loading={loading}
        />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
