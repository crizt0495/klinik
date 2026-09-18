"use client";

import { TrendingUp } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIDR } from "@/lib/utils";

type TrendData = Array<{ month: string; label: string; revenue: number; visits: number }>;

interface RevenueChartProps {
  data: TrendData;
}

export function RevenueChart({ data }: RevenueChartProps) {
  const hasData = data.some((d) => d.revenue > 0 || d.visits > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> Pendapatan & Kunjungan
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">Belum ada data.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" strokeOpacity={0.7} vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} dy={6} />
              <YAxis
                yAxisId="rev"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                width={48}
                tickFormatter={(v: number) => (v >= 1000000 ? `${Math.round(v / 1e6)}jt` : `${v / 1000}k`)}
              />
              <YAxis yAxisId="visits" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={30} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "color-mix(in oklch, var(--muted) 55%, transparent)" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                  boxShadow: "var(--shadow-pop)",
                }}
                formatter={(value, name) => {
                  if (name === "Pendapatan") return [formatIDR(Number(value)), name];
                  if (name === "Kunjungan") return [`${value} kunjungan`, name];
                  return [value, name];
                }}
                labelFormatter={(label) => <span className="font-medium">{label}</span>}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="rev" dataKey="revenue" name="Pendapatan" barSize={18} fill="var(--chart-1)" radius={[5, 5, 0, 0]} />
              <Line yAxisId="visits" type="monotone" dataKey="visits" name="Kunjungan" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}