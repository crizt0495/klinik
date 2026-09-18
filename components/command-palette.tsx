"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, CalendarPlus, ListOrdered, Receipt, Pill, LayoutDashboard, MessageSquareText } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { globalSearchAction, type SearchResult } from "@/features/search/actions";

const emptySubscribe = () => () => {};

export function CommandPalette({ open: openProp, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = React.useRef(false);

  const effectiveOpen = openProp ?? open;

  const effectiveOpenRef = React.useRef(effectiveOpen);
  React.useEffect(() => {
    effectiveOpenRef.current = effectiveOpen;
  });

  const close = React.useCallback(() => {
    closedRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setOpen(false);
    onOpenChange(false);
    setQuery("");
    setResults([]);
    setSearching(false);
  }, [onOpenChange]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (effectiveOpenRef.current) {
          close();
        } else {
          setOpen(true);
          onOpenChange(true);
        }
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [close, onOpenChange]);

  const onQueryChange = React.useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const r = await globalSearchAction(value);
          if (!closedRef.current) setResults(r);
        } finally {
          if (!closedRef.current) setSearching(false);
        }
      }, 250);
    },
    [],
  );

  const go = React.useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  if (!mounted) return null;

  return (
    <CommandDialog open={effectiveOpen} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <CommandInput icon={<Search className="h-4 w-4" />} placeholder="Cari pasien, dokter, resep, invoice, obat..." value={query} onChange={(e) => onQueryChange(e.target.value)} />
      <CommandList>
        <CommandEmpty>{searching ? "Mencari..." : "Tidak ditemukan."}</CommandEmpty>
        {query.length < 2 ? (
          <CommandGroup heading="Tindakan cepat">
            <CommandItem onSelect={() => go("/patients")}>
              <UserPlus className="h-4 w-4" /> Buat pasien baru
            </CommandItem>
            <CommandItem onSelect={() => go("/appointments")}>
              <CalendarPlus className="h-4 w-4" /> Buat appointment
            </CommandItem>
            <CommandItem onSelect={() => go("/queue")}>
              <ListOrdered className="h-4 w-4" /> Buka antrian
            </CommandItem>
            <CommandItem onSelect={() => go("/pharmacy")}>
              <Pill className="h-4 w-4" /> Buka farmasi
            </CommandItem>
            <CommandItem onSelect={() => go("/billing")}>
              <Receipt className="h-4 w-4" /> Buka penagihan
            </CommandItem>
            <CommandItem onSelect={() => go("/dashboard")}>
              <LayoutDashboard className="h-4 w-4" /> Buka dashboard
            </CommandItem>
          </CommandGroup>
        ) : null}
        {results.length > 0 ? (
          <CommandGroup heading="Hasil pencarian">
            {results.map((r, i) => (
              <CommandItem key={`${r.type}-${i}`} onSelect={() => go(r.href)}>
                <MessageSquareText className="h-4 w-4 opacity-60" />
                <div className="flex flex-col">
                  <span className="text-sm">{r.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.type} · {r.sublabel}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}