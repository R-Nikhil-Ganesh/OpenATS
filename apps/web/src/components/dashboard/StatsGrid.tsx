'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Users, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { dashboardApi } from '@/lib/api';

type StatCard = {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
  pulse?: boolean;
  trend?: string;
};

function StatCardItem({
  card,
  index,
}: {
  card: StatCard;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle gradient accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '80px',
          height: '80px',
          background: `radial-gradient(circle, ${card.color}18, transparent 70%)`,
          borderRadius: '0 14px 0 0',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748B' }}>{card.label}</span>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '10px',
            background: card.bg,
            border: `1px solid ${card.color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: card.color,
            position: 'relative',
          }}
        >
          {card.icon}
          {card.pulse && card.value > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: card.color,
                animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
              }}
            />
          )}
        </div>
      </div>

      <div>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            display: 'block',
            fontSize: '36px',
            fontWeight: 800,
            color: '#F1F5F9',
            lineHeight: 1,
            letterSpacing: '-1px',
          }}
        >
          {card.value.toLocaleString()}
        </motion.span>
        {card.trend && (
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: 4, display: 'block' }}>
            {card.trend}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function SkeletonStat() {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '14px',
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className="skeleton" style={{ height: 14, width: 80, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 38, width: 38, borderRadius: 10 }} />
      </div>
      <div className="skeleton" style={{ height: 40, width: 70, borderRadius: 8 }} />
    </div>
  );
}

export function StatsGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.getSummary().then((r) => r.data),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[1, 2, 3, 4].map((i) => <SkeletonStat key={i} />)}
      </div>
    );
  }

  const cards: StatCard[] = [
    {
      label: 'Active Jobs',
      value: data.active_jobs,
      icon: <Briefcase size={18} />,
      color: '#6366F1',
      bg: 'rgba(99,102,241,0.12)',
      trend: 'Open positions',
    },
    {
      label: 'Total Applicants',
      value: data.total_applicants,
      icon: <Users size={18} />,
      color: '#818CF8',
      bg: 'rgba(129,140,248,0.12)',
      trend: 'Across all jobs',
    },
    {
      label: 'Queue Backlog',
      value: data.queue_backlog,
      icon: <Clock size={18} />,
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.12)',
      pulse: true,
      trend: data.queue_backlog > 0 ? 'Processing in queue' : 'All clear',
    },
    {
      label: 'Failed Jobs',
      value: data.failed_count,
      icon: <AlertCircle size={18} />,
      color: '#F43F5E',
      bg: 'rgba(244,63,94,0.12)',
      pulse: true,
      trend: data.failed_count > 0 ? 'Requires attention' : 'No failures',
    },
  ];

  return (
    <>
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {cards.map((card, i) => (
          <StatCardItem key={card.label} card={card} index={i} />
        ))}
      </div>
    </>
  );
}
