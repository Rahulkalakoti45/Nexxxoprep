import { Construction } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col items-center justify-center py-20 text-center">
        <Construction className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          This section is planned for a future release and will be available soon.
        </p>
      </CardContent>
    </Card>
  );
}
