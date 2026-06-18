'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChurnDataPoint {
  month: string;
  cancelled: number;
}

interface ChurnChartProps {
  data: ChurnDataPoint[];
}

export function ChurnChart({ data }: ChurnChartProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <h2 className="text-base font-semibold text-text-primary mb-4">Monthly Churn (last 12 months)</h2>

      {data.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-8">No data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
            <XAxis dataKey="month" stroke="#8B949E" tick={{ fontSize: 11 }} />
            <YAxis stroke="#8B949E" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8 }}
              labelStyle={{ color: '#8B949E' }}
            />
            <Bar dataKey="cancelled" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
