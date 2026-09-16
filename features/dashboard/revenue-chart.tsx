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
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-primary" /> Pendapatan & Kunjungan
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">Belum ada data.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} dy={6} />
              <YAxis
                yAxisId="rev"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                width={48}
                tickFormatter={(v: number) => (v >= 1000000 ? `${Math.round(v / 1e6)}jt` : `${v / 1000}k`)}
              />
              <YAxis yAxisId="visits" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={30} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                formatter={(value, name) => {
                  if (name === "Pendapatan") return [formatIDR(Number(value)), name];
                  if (name === "Kunjungan") return [`${value} kunjungan`, name];
                  return [value, name];
                }}
                labelFormatter={(label) => <span className="font-medium">{label}</span>}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="rev" dataKey="revenue" name="Pendapatan" barSize={18} fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Line yAxisId="visits" type="monotone" dataKey="visits" name="Kunjungan" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}