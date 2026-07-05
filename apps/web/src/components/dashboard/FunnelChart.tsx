'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { dashboardApi } from '@/lib/api';
import { Card } from '@/components/ui/Card';

const TIER_COLORS: Record<string, string> = {
  A: '#10B981',
  B: '#F59E0B',
  C: '#64748B',
};

type TooltipPayload = {
  name?: string;
  value?: number;
  payload?: { tier: string; count: number };
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: '#1E2229',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '9px',
        padding: '10px 14px',
        fontSize: '13px',
        color: '#E2E8F0',
      }}
    >
      <strong>Tier {d?.tier}</strong>: {d?.count} candidates
    </div>
  );
}

export function FunnelChart() {
  const { data } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.getSummary().then((r) => r.data),
  });

  const chartData = data?.tier_distribution ?? [
    { tier: 'A', count: 0 },
    { tier: 'B', count: 0 },
    { tier: 'C', count: 0 },
  ];

  return (
    <Card padding="24px" style={{ height: '100%' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3
          style={{
            margin: '0 0 4px',
            fontSize: '15px',
            fontWeight: 700,
            color: '#F1F5F9',
          }}
        >
          Candidate Tier Distribution
        </h3>
        <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
          Breakdown by AI-assigned tier across all active jobs
        </p>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="tier"
            type="category"
            tick={{ fontSize: 13, fill: '#94A3B8', fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={(v: string) => `Tier ${v}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
            {chartData.map((entry) => (
              <Cell
                key={entry.tier}
                fill={TIER_COLORS[entry.tier] ?? '#64748B'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
        {Object.entries(TIER_COLORS).map(([tier, color]) => (
          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
              }}
            />
            <span style={{ fontSize: '12px', color: '#64748B' }}>Tier {tier}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
