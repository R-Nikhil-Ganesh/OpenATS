'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Upload, LayoutGrid, Pencil } from 'lucide-react';
import { jobsApi } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TierTabs } from '@/components/candidates/TierTabs';
import { Spinner } from '@/components/ui/Spinner';
import { EditJobModal } from '@/components/jobs/EditJobModal';
import { formatDate } from '@/lib/utils';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id).then((r) => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['job-stats', id],
    queryFn: () => jobsApi.getStats(id).then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.processing ?? 0) > 0 ? 10_000 : false,
  });

  // Poll while jobs are processing
  useEffect(() => {
    if ((stats?.processing ?? 0) > 0 || (stats?.queued ?? 0) > 0) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['job-applications', id] });
        queryClient.invalidateQueries({ queryKey: ['job-stats', id] });
      }, 10_000);
      return () => clearInterval(interval);
    }
  }, [stats, id, queryClient]);

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
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
        <Link href="/jobs" style={{ color: '#64748B', textDecoration: 'none' }}>Jobs</Link>
        <ChevronRight size={13} color="#475569" />
        <span style={{ color: '#E2E8F0', fontWeight: 500 }}>{job.title}</span>
      </nav>

      {/* Job header */}
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
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
                color: '#F1F5F9',
                letterSpacing: '-0.5px',
              }}
            >
              {job.title}
            </h1>
            <Badge status={job.status} />
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#64748B' }}>🏢 {job.department}</span>
            {job.location && (
              <span style={{ fontSize: '13px', color: '#64748B' }}>📍 {job.location}</span>
            )}
            <span style={{ fontSize: '13px', color: '#64748B' }}>
              🗓 Created {formatDate(job.created_at)}
            </span>
            {(job.experience_years_min !== undefined && job.experience_years_max !== undefined) && (
              <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                <span style={{ color: '#E2E8F0' }}>Experience:</span> {job.experience_years_min}-{job.experience_years_max} yrs
              </p>
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
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
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
              { label: 'Total', value: total, color: '#94A3B8' },
              { label: 'Queued', value: queued, color: '#64748B' },
              { label: 'Processing', value: processing, color: '#F59E0B' },
              { label: 'Done', value: done, color: '#10B981' },
              { label: 'Failed', value: failed, color: '#F43F5E' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color }}>{value}</span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 6,
              background: 'rgba(255,255,255,0.07)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${donePercent}%`,
                background: 'linear-gradient(90deg, #6366F1, #10B981)',
                borderRadius: 10,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748B' }}>
            {Math.round(donePercent)}% processed
          </p>
        </div>
      )}

      {/* Tier tabs */}
      <div>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: '#F1F5F9' }}>
          Candidates
        </h2>
        <TierTabs jobId={id} />
      </div>
    </div>
  );
}
