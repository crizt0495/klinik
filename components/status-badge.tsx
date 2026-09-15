import { Badge } from "@/components/ui/badge";
import { BADGE_VARIANT, STATUS_LABEL } from "@/lib/constants";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span>-</span>;
  return <Badge variant={BADGE_VARIANT[status] ?? "secondary"}>{STATUS_LABEL[status] ?? status}</Badge>;
}