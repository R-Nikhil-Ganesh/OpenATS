'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { roleHistoryApi, type RoleHistoryEntry } from '@/lib/api';
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

  const milestoneColor: Record<string, string> = {
    hired: 'var(--color-success)',
    interviewing: 'var(--color-warning)',
    screening: 'var(--color-primary)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px' }}>
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
          background: 'rgba(var(--ink-rgb),0.02)',
          border: '1px solid rgba(var(--ink-rgb),0.07)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 1.5fr 80px 80px 120px 120px 24px',
            gap: '12px',
            padding: '12px 18px',
            borderBottom: '1px solid rgba(var(--ink-rgb),0.06)',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}
        >
          <span>Name</span>
          <span>Role</span>
          <span>Department</span>
          <span>Tier</span>
          <span>Score</span>
          <span>Milestone</span>
          <span>Date</span>
          <span />
        </div>

        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid rgba(var(--ink-rgb),0.04)',
                }}
              >
                <div className="skeleton" style={{ height: 16, width: `${60 + i * 5}%`, borderRadius: 6 }} />
              </div>
            ))
          : entries.map((entry) => (
              <React.Fragment key={entry.id}>
                <div
                  onClick={() =>
                    setExpandedId((prev) => (prev === entry.id ? null : entry.id))
                  }
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 1.5fr 80px 80px 120px 120px 24px',
                    gap: '12px',
                    padding: '14px 18px',
                    borderBottom: '1px solid rgba(var(--ink-rgb),0.04)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(var(--ink-rgb),0.025)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-strong)' }}>
                    {entry.candidate_name}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>{entry.role}</span>
                  <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>{entry.department}</span>
                  <Badge tier={entry.tier} size="sm" />
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: milestoneColor[entry.milestone] ?? 'var(--color-muted)',
                    }}
                  >
                    {formatScore(entry.score)}
                  </span>
                  <span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '20px',
                        color: milestoneColor[entry.milestone] ?? 'var(--color-muted)',
                        background: `${milestoneColor[entry.milestone] ?? 'var(--color-muted)'}18`,
                        border: `1px solid ${milestoneColor[entry.milestone] ?? 'var(--color-muted)'}30`,
                        textTransform: 'capitalize',
                      }}
                    >
                      {entry.milestone}
                    </span>
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                    {formatDate(entry.accepted_at)}
                  </span>
                  <span style={{ color: 'var(--color-muted)' }}>
                    {expandedId === entry.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>

                <AnimatePresence>
                  {expandedId === entry.id && entry.skill_pattern && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          padding: '14px 18px',
                          background: 'rgba(var(--color-primary-rgb),0.04)',
                          borderBottom: '1px solid rgba(var(--ink-rgb),0.04)',
                          fontSize: '13px',
                          color: 'var(--color-muted)',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--color-primary-light)', marginRight: 8 }}>
                          Skill Pattern:
                        </span>
                        {entry.skill_pattern}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </React.Fragment>
            ))}

        {!isLoading && entries.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-muted)', fontSize: '14px' }}>
            No historical records found
          </div>
        )}
      </div>
    </div>
  );
}
