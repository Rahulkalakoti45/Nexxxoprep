import { Bell, RefreshCw, Search } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function TopNav({
  search,
  onSearchChange,
  onRefresh,
  loading,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="relative flex-1 md:max-w-md">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          className="h-10 bg-muted/40 pl-9"
          placeholder="Search candidates..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
        <div className="ml-2 flex items-center gap-3 border-l border-border pl-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">Recruiter Admin</p>
            <p className="text-xs text-muted-foreground">Operations</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            RA
          </div>
        </div>
      </div>
    </header>
  );
}
