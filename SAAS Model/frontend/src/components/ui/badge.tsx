import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-accent text-primary",
        success: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
        warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  children,
}: VariantProps<typeof badgeVariants> & {
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}

export function statusBadgeVariant(status: string): VariantProps<typeof badgeVariants>["variant"] {
  switch (status) {
    case "FINAL_SELECTED":
      return "success";
    case "REJECTED":
    case "EXPIRED":
    case "FAILED":
      return "danger";
    case "INTERVIEW_STARTED":
    case "SENT":
      return "default";
    case "INTERVIEW_COMPLETED":
      return "success";
    case "QUEUED":
    case "SHORTLISTED":
    case "INVITED":
      return "warning";
    default:
      return "muted";
  }
}
