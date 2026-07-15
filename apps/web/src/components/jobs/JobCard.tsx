'use client';

import React from 'react';
import Link from 'next/link';
import { Users, Eye, Building2, MapPin, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Job } from '@/lib/api';

type JobCardProps = {
  job: Job;
};

export function JobCard({ job }: JobCardProps) {
  const [hovered, setHovered] = React.useState(false);
  const processing = job.processing_count ?? 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: hovered
          ? '0 2px 12px rgba(var(--shadow-rgb),0.08)'
          : '0 1px 2px rgba(var(--shadow-rgb),0.04)',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        borderColor: hovered ? 'rgba(var(--ink-rgb),0.15)' : 'var(--color-border)',
      }}
    >
      {/* Header: title + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            lineHeight: 1.35,
            flex: 1,
            minWidth: 0,
          }}
        >
          {job.title}
        </h3>
        <Badge status={job.status} size="sm" />
      </div>

      {/* Meta: department + location + processing */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px' }}>
        <MetaItem icon={<Building2 size={13} />} label={job.department} />
        {job.location && <MetaItem icon={<MapPin size={13} />} label={job.location} />}
        {processing > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--color-warning)',
              background: 'rgba(var(--color-warning-rgb),0.10)',
              border: '1px solid rgba(var(--color-warning-rgb),0.28)',
              borderRadius: 999,
              padding: '2px 9px',
              lineHeight: 1.4,
            }}
          >
            <Loader2 size={11} className="spin-slow" />
            {processing} processing
          </span>
        )}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4,
          padding: '12px 4px',
          background: 'rgba(var(--ink-rgb),0.02)',
          borderRadius: 9,
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <Stat label="Total" value={job.total_applicants ?? 0} icon={<Users size={12} />} color="var(--color-text-primary)" />
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

function MetaItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12.5,
        color: 'var(--color-muted)',
        lineHeight: 1.4,
      }}
    >
      <span style={{ display: 'inline-flex', color: 'var(--color-text-secondary)' }}>{icon}</span>
      {label}
    </span>
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 17, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </span>
      <span
        style={{
          fontSize: 10.5,
          color: 'var(--color-text-secondary)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 600,
        }}
      >
        {icon} {label}
      </span>
    </div>
  );
}
