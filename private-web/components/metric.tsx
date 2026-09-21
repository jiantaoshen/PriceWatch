import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function Metric({
  label,
  value,
  help,
}: {
  label: string;
  value: ReactNode;
  help?: string;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-5 pb-0 pt-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-2">
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
        {help && <div className="mt-2 text-xs text-muted-foreground">{help}</div>}
      </CardContent>
    </Card>
  );
}
