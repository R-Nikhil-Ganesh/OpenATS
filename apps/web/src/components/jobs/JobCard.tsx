'use client';

import React from 'react';
import Link from 'next/link';
import { Users, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Job } from '@/lib/api';

type JobCardProps = {
  job: Job;
};

export function JobCard({ job }: JobCardProps) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--color-surface)',
        border: hovered
          ? '1px solid rgba(var(--color-primary-rgb),0.4)'
          : '1px solid var(--color-border)',
        borderRadius: '14px',
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 8px 32px rgba(var(--color-primary-rgb),0.18)'
          : '0 2px 8px rgba(var(--shadow-rgb),0.056)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <h3
            style={{
              margin: '0 0 8px',
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1.3,
            }}
          >
            {job.title}
          </h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <Badge status="applied">{job.department}</Badge>
            <Badge status={job.status}>{job.status.charAt(0).toUpperCase() + job.status.slice(1)}</Badge>
            {job.location && (
              <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{job.location}</span>
            )}
          </div>
        </div>
        {(job.processing_count ?? 0) > 0 && (
          <span
            style={{
              background: 'rgba(var(--color-warning-rgb),0.12)',
              border: '1px solid rgba(var(--color-warning-rgb),0.3)',
              borderRadius: '20px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-warning)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {job.processing_count} processing
          </span>
        )}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          padding: '12px',
          background: 'rgba(var(--ink-rgb),0.02)',
          borderRadius: '9px',
          border: '1px solid rgba(var(--ink-rgb),0.05)',
        }}
      >
        <Stat label="Total" value={job.total_applicants ?? 0} icon={<Users size={13} />} color="var(--color-muted)" />
        <Stat label="Tier A" value={job.tier_a_count ?? 0} color="var(--color-success)" />
        <Stat label="Tier B" value={job.tier_b_count ?? 0} color="var(--color-warning)" />
        <Stat label="Tier C" value={job.tier_c_count ?? 0} color="var(--color-muted)" />
      </div>

      {/* Action */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none' }}>
          <Button variant="outline" size="sm">
            <Eye size={13} />
            View Job
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
      <span style={{ fontSize: '18px', fontWeight: 700, color }}>{value}</span>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--color-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
        }}
      >
        {icon} {label}
      </span>
    </div>
  );
}
