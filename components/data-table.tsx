"use client";

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  selectable?: boolean;
  onRowClick?: (row: TData) => void;
  pageSize?: number;
  exportable?: boolean;
  exportFilename?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<TData, TValue>({ columns, data, loading, searchable = true, searchPlaceholder = "Cari...", selectable, onRowClick, pageSize = 10, exportable, exportFilename = "data", emptyTitle = "Tidak ada data", emptyDescription }: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    enableRowSelection: selectable ?? false,
    enableMultiRowSelection: selectable ?? false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const exportCSV = () => {
    const visibleCols = table.getVisibleLeafColumns().filter((c) => c.getCanSort() && (c.columnDef.header as string) !== "");
    const header = visibleCols.map((c) => `"${String(c.columnDef.header ?? "").replace(/"/g, '""')}"`).join(",");
    const rows = table.getFilteredRowModel().rows.map((row) =>
      visibleCols
        .map((col) => {
          const v = row.getValue(col.id);
          return `"${String(v ?? "").replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          {searchable ? (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input placeholder={searchPlaceholder} value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="bg-muted/30 pl-9" />
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {exportable ? (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Kolom <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllLeafColumns().map((column) => {
                if (!column.getCanHide()) return null;
                return (
                  <DropdownMenuCheckboxItem key={column.id} className="capitalize" checked={column.getIsVisible()} onCheckedChange={(value) => column.toggleVisibility(!!value)}>
                    {String(column.columnDef.header ?? column.id)}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-5 shadow-card">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={() => onRowClick?.(row.original)}
                    className={onRowClick ? "cursor-pointer" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <EmptyState title={emptyTitle} description={emptyDescription} className="border-0 bg-transparent py-10" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && table.getFilteredRowModel().rows.length > 0 ? (
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="nums text-xs text-muted-foreground">
            Menampilkan {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} dari {table.getFilteredRowModel().rows.length}
            {selectable ? ` (${Object.keys(rowSelection).length} dipilih)` : ""}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { ColumnDef as DataTableColumn };