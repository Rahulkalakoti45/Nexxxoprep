import { useState } from "react";
import { DashboardLayout } from "./layout/DashboardLayout";
import type { NavItem } from "./layout/Sidebar";
import { ActivityPage } from "./pages/ActivityPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { CandidatesPage } from "./pages/CandidatesPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { DashboardHome } from "./pages/DashboardHome";
import { useDashboardData } from "./hooks/useDashboardData";

function App() {
  const [activeNav, setActiveNav] = useState<NavItem>("dashboard");
  const data = useDashboardData();

  const renderContent = () => {
    switch (activeNav) {
      case "dashboard":
        return <DashboardHome data={data} />;
      case "candidates":
        return <CandidatesPage data={data} />;
      case "activity":
        return <ActivityPage data={data} />;
      case "analytics":
        return <AnalyticsPage data={data} />;
      case "reports":
        return <ComingSoonPage title="Reports" />;
      case "settings":
        return <ComingSoonPage title="Settings" />;
      default:
        return <DashboardHome data={data} />;
    }
  };

  return (
    <DashboardLayout
      activeNav={activeNav}
      onNavigate={setActiveNav}
      search={data.search}
      onSearchChange={data.setSearch}
      onRefresh={() => void data.refresh()}
      loading={data.loading}
    >
      {data.error ? (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {data.error}
        </div>
      ) : null}
      {renderContent()}
    </DashboardLayout>
  );
}

export default App;
