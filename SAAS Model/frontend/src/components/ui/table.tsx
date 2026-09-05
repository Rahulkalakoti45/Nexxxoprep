import { cn } from "../../lib/utils";

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)}>{children}</table>
    </div>
  );
}

export function TableHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <thead className={cn("border-b border-border bg-card", className)}>{children}</thead>;
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-border transition-colors hover:bg-muted/50">{children}</tr>;
}

export function TableHead({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th className={cn("h-11 px-4 text-left font-medium text-muted-foreground", className)}>{children}</th>
  );
}

export function TableCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}
