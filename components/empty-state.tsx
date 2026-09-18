import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-14 text-center", className)}>
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-border/70 bg-card text-muted-foreground shadow-2xs [&_svg]:h-5 [&_svg]:w-5">
        {icon ?? <Inbox />}
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className="text-sm font-semibold tracking-[-0.01em]">{title}</h3>
        {description ? <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
