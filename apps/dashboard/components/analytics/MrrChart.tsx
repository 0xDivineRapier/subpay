'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MrrDataPoint {
  date: string;
  mrr: number;
}

interface MrrChartProps {
  data: MrrDataPoint[];
}

type Range = '30d' | '90d' | '1yr';

const RANGE_DAYS: Record<Range, number> = { '30d': 30, '90d': 90, '1yr': 365 };

export function MrrChart({ data }: MrrChartProps) {
  const [range, setRange] = useState<Range>('90d');

  const days = RANGE_DAYS[range];
  const filtered = data.slice(-days);

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-text-primary">MRR Trend</h2>
        <div className="flex gap-1">
          {(['30d', '90d', '1yr'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                range === r
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-8">No data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={filtered}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
            <XAxis dataKey="date" stroke="#8B949E" tick={{ fontSize: 11 }} />
            <YAxis stroke="#8B949E" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8 }}
              labelStyle={{ color: '#8B949E' }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'MRR']}
            />
            <Line
              type="monotone"
              dataKey="mrr"
              stroke="#2563EB"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
