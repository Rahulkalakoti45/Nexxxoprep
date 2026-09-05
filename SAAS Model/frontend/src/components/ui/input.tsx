import { cn } from "../../lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm",
        "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 rounded-lg border border-border bg-card px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-primary/40",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
