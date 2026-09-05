import { cn } from "../../lib/utils";

const variants = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border bg-card hover:bg-muted",
  ghost: "hover:bg-muted",
} as const;

const sizes = {
  default: "h-10 px-4",
  sm: "h-9 px-3 text-xs",
  icon: "h-9 w-9 p-0",
} as const;

export function Button({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
