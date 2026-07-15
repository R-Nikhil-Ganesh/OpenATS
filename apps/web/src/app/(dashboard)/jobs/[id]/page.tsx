'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Upload, LayoutGrid, Pencil, Building2, MapPin, CalendarDays } from 'lucide-react';
import { jobsApi } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ApplicationsTable } from '@/components/applications/ApplicationsTable';
import { Spinner } from '@/components/ui/Spinner';
import { EditJobModal } from '@/components/jobs/EditJobModal';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { formatDate } from '@/lib/utils';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = React.useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id).then((r) => r.data),
  });

  // SSEProvider (mounted in the dashboard layout) pushes invalidations for
  // job-stats/job-applications as processing events arrive; this interval is
  // just a fallback in case the SSE connection drops.
  const { data: stats } = useQuery({
    queryKey: ['job-stats', id],
    queryFn: () => jobsApi.getStats(id).then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.processing ?? 0) > 0 ? 10_000 : false,
  });

  if (isLoading || !job) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  const processing = stats?.processing ?? 0;
  const queued = stats?.queued ?? 0;
  const failed = stats?.failed ?? 0;

  const donePercent = total > 0 ? (done / total) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
      <Breadcrumb items={[{ label: 'Jobs', href: '/jobs' }, { label: job.title }]} />

      {/* Job header */}
      <div
        style={{
          background: 'rgba(var(--ink-rgb),0.03)',
          border: '1px solid rgba(var(--ink-rgb),0.08)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '26px',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.5px',
              }}
            >
              {job.title}
            </h1>
            <Badge status={job.status} />
          </div>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
            <MetaItem icon={<Building2 size={13} />} label={job.department} />
            {job.location && <MetaItem icon={<MapPin size={13} />} label={job.location} />}
            <MetaItem icon={<CalendarDays size={13} />} label={`Created ${formatDate(job.created_at)}`} />
            {(job.experience_years_min !== undefined && job.experience_years_max !== undefined) && (
              <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                <span style={{ color: 'var(--color-text-strong)', fontWeight: 500 }}>Experience:</span>{' '}
                {job.experience_years_min}–{job.experience_years_max} yrs
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link href={`/jobs/${id}/upload`} style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="md">
              <Upload size={14} />
              Upload Resumes
            </Button>
          </Link>
          <Link href={`/jobs/${id}/board`} style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="md">
              <LayoutGrid size={14} />
              View Board
            </Button>
          </Link>
          <Button variant="ghost" size="md" onClick={() => setEditOpen(true)}>
            <Pencil size={14} />
            Edit
          </Button>
        </div>
      </div>

      <EditJobModal job={job} open={editOpen} onClose={() => setEditOpen(false)} />

      {/* Processing stats bar */}
      {total > 0 && (
        <div
          style={{
            background: 'rgba(var(--ink-rgb),0.02)',
            border: '1px solid rgba(var(--ink-rgb),0.07)',
            borderRadius: '12px',
            padding: '16px 20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '24px',
              marginBottom: '12px',
              flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'Total', value: total, color: 'var(--color-muted)' },
              { label: 'Queued', value: queued, color: 'var(--color-muted)' },
              { label: 'Processing', value: processing, color: 'var(--color-warning)' },
              { label: 'Done', value: done, color: 'var(--color-success)' },
              { label: 'Failed', value: failed, color: 'var(--color-danger)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color }}>{value}</span>
                <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 6,
              background: 'rgba(var(--ink-rgb),0.07)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${donePercent}%`,
                background: 'var(--color-primary)',
                borderRadius: 10,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--color-muted)' }}>
            {Math.round(donePercent)}% processed
          </p>
        </div>
      )}

      {/* Candidates table */}
      <div>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Candidates
        </h2>
        <ApplicationsTable jobId={id} />
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
        gap: 6,
        fontSize: 13,
        color: 'var(--color-muted)',
      }}
    >
      <span style={{ display: 'inline-flex', color: 'var(--color-text-secondary)' }}>{icon}</span>
      {label}
    </span>
  );
}
