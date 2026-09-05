import { Inbox } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
      <Inbox className="h-10 w-10 opacity-50" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  );
}
