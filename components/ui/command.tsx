"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const Command = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground", className)} {...props} />
));
Command.displayName = "Command";

type CommandInputProps = React.ComponentProps<"input"> & { icon?: React.ReactNode };

const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(({ className, icon, ...props }, ref) => (
  <div className="flex items-center border-b border-border/70 px-4">
    <div className="mr-2 shrink-0 text-muted-foreground">{icon}</div>
    <input ref={ref} className={cn("flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
  </div>
));
CommandInput.displayName = "CommandInput";

const CommandList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("scrollbar-thin max-h-[320px] overflow-y-auto overflow-x-hidden p-1", className)} {...props} />
));
CommandList.displayName = "CommandList";

const CommandEmpty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("py-8 text-center text-sm text-muted-foreground", className)} {...props} />
));
CommandEmpty.displayName = "CommandEmpty";

const CommandGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { heading?: React.ReactNode }>(({ className, heading, ...props }, ref) => (
  <div ref={ref} className={cn("overflow-hidden p-1 text-foreground", className)}>
    {heading ? <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{heading}</div> : null}
    {props.children}
  </div>
));
CommandGroup.displayName = "CommandGroup";

const CommandItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { onSelect?: () => void; disabled?: boolean }>(({ className, onSelect, disabled, ...props }, ref) => (
  <div
    ref={ref}
    role="option"
    aria-disabled={disabled}
    aria-selected={false}
    onClick={(e) => {
      e.stopPropagation();
      if (disabled) return;
      onSelect?.();
    }}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground hover:bg-accent hover:text-accent-foreground",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";

const CommandSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mx-1 h-px bg-border/70", className)} {...props} />
));
CommandSeparator.displayName = "CommandSeparator";

const CommandDialog = ({ children, ...props }: React.ComponentProps<typeof Dialog>) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-pop">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">{children}</Command>
      </DialogContent>
    </Dialog>
  );
};

export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator };