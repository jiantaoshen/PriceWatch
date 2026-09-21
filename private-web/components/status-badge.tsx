import { Badge } from "@/components/ui/badge";

type BadgeVariant = "success" | "warning" | "destructive" | "secondary";

const variantByStatus: Record<string, BadgeVariant> = {
  success: "success",
  accepted: "success",
  "below target": "success",
  failed: "destructive",
  rejected: "destructive",
  suspicious: "warning",
  partial: "warning",
  pending: "warning",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant={variantByStatus[value.toLowerCase()] ?? "secondary"}>
      {value}
    </Badge>
  );
}
