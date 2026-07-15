'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { roleHistoryApi } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { formatDate, formatScore } from '@/lib/utils';

const departmentOptions = [
  { value: '', label: 'All Departments' },
  { value: 'Engineering', label: 'Engineering' },
  { value: 'Product', label: 'Product' },
  { value: 'Design', label: 'Design' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Sales', label: 'Sales' },
];

const milestoneOptions = [
  { value: '', label: 'All Milestones' },
  { value: 'hired', label: 'Hired' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'screening', label: 'Screening' },
];

const GRID_COLS = '2fr 2fr 1.5fr 72px 76px 128px 120px 28px';

const milestoneRgb: Record<string, string> = {
  hired: 'var(--color-success-rgb)',
  interviewing: 'var(--color-warning-rgb)',
  screening: 'var(--color-primary-rgb)',
};

const milestoneColor: Record<string, string> = {
  hired: 'var(--color-success)',
  interviewing: 'var(--color-warning)',
  screening: 'var(--color-primary)',
};

function ScorePill({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>—</span>;
  }
  const val = Math.round(score);
  const good = val >= 80;
  const mid = val >= 60 && val < 80;
  const color = good ? 'var(--color-success)' : mid ? 'var(--color-warning)' : 'var(--color-muted)';
  const rgb = good ? 'var(--color-success-rgb)' : mid ? 'var(--color-warning-rgb)' : 'var(--color-muted-rgb)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 44,
        height: 22,
        padding: '0 8px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.01em',
        color,
        background: `rgba(${rgb}, 0.12)`,
        border: `1px solid rgba(${rgb}, 0.24)`,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {formatScore(val)}
    </span>
  );
}

function MilestonePill({ milestone }: { milestone: string }) {
  const color = milestoneColor[milestone] ?? 'var(--color-muted)';
  const rgb = milestoneRgb[milestone] ?? 'var(--color-muted-rgb)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 88,
        height: 22,
        padding: '0 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color,
        background: `rgba(${rgb}, 0.12)`,
        border: `1px solid rgba(${rgb}, 0.24)`,
        textTransform: 'capitalize',
      }}
    >
      {milestone}
    </span>
  );
}

export function RoleHistoryTable() {
  const [department, setDepartment] = useState('');
  const [milestone, setMilestone] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['role-history', department, milestone],
    queryFn: () =>
      roleHistoryApi
        .list({ department: department || undefined, milestone: milestone || undefined })
        .then((r) => r.data),
  });

  const entries = data?.entries ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 200 }}>
          <Select
            options={departmentOptions}
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </div>
        <div style={{ width: 200 }}>
          <Select
            options={milestoneOptions}
            value={milestone}
            onChange={(e) => setMilestone(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLS,
            gap: 12,
            padding: '12px 18px',
            background: 'rgba(var(--ink-rgb),0.02)',
            borderBottom: '1px solid var(--color-border)',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            alignItems: 'center',
          }}
        >
          <span>Name</span>
          <span>Role</span>
          <span>Department</span>
          <span style={{ textAlign: 'center' }}>Tier</span>
          <span style={{ textAlign: 'center' }}>Score</span>
          <span style={{ textAlign: 'center' }}>Milestone</span>
          <span>Date</span>
          <span />
        </div>

        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <div className="skeleton" style={{ height: 16, width: `${60 + i * 5}%`, borderRadius: 6 }} />
              </div>
            ))
          : entries.map((entry) => {
              const isOpen = expandedId === entry.id;
              return (
                <React.Fragment key={entry.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedId((prev) => (prev === entry.id ? null : entry.id))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedId((prev) => (prev === entry.id ? null : entry.id));
                      }
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: GRID_COLS,
                      gap: 12,
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      background: isOpen ? 'rgba(var(--ink-rgb),0.025)' : 'transparent',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => {
                      if (!isOpen) e.currentTarget.style.background = 'rgba(var(--ink-rgb),0.02)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isOpen) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-strong)' }}>
                      {entry.candidate_name}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-body)' }}>{entry.role}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{entry.department}</span>
                    <span style={{ display: 'flex', justifyContent: 'center' }}>
                      <Badge tier={entry.tier} size="sm" />
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'center' }}>
                      <ScorePill score={entry.score} />
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'center' }}>
                      <MilestonePill milestone={entry.milestone} />
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                      {formatDate(entry.accepted_at)}
                    </span>
                    <span
                      style={{
                        color: 'var(--color-text-secondary)',
                        display: 'inline-flex',
                        justifyContent: 'center',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <ChevronDown size={14} />
                    </span>
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div
                          style={{
                            padding: '14px 18px',
                            background: 'rgba(var(--ink-rgb),0.025)',
                            borderBottom: '1px solid var(--color-border-subtle)',
                            fontSize: 13,
                            color: 'var(--color-text-body)',
                            lineHeight: 1.55,
                          }}
                        >
                          <span
                            style={{
                              display: 'block',
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: '0.07em',
                              textTransform: 'uppercase',
                              color: 'var(--color-text-secondary)',
                              marginBottom: 6,
                            }}
                          >
                            Skill pattern
                          </span>
                          {entry.skill_pattern || (
                            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                              No skill pattern recorded for this entry.
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}

        {!isLoading && entries.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
            No historical records found
          </div>
        )}
      </div>
    </div>
  );
}
