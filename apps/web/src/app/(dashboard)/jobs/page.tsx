'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Briefcase } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api';
import { JobCard } from '@/components/jobs/JobCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

type StatusFilter = 'all' | 'active' | 'draft' | 'closed';

function SkeletonJobCard() {
  return (
    <div
      style={{
        background: 'rgba(var(--ink-rgb),0.02)',
        border: '1px solid rgba(var(--ink-rgb),0.06)',
        borderRadius: '14px',
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div className="skeleton" style={{ height: 22, width: '65%', borderRadius: 7 }} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <div className="skeleton" style={{ height: 20, width: 80, borderRadius: 20 }} />
        <div className="skeleton" style={{ height: 20, width: 60, borderRadius: 20 }} />
      </div>
      <div className="skeleton" style={{ height: 60, borderRadius: 9 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="skeleton" style={{ height: 30, width: 90, borderRadius: 7 }} />
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', statusFilter],
    queryFn: () =>
      jobsApi
        .list({ status: statusFilter === 'all' ? undefined : statusFilter })
        .then((r) => r.data),
  });

  const jobs = data?.jobs ?? [];
  const filters: StatusFilter[] = ['all', 'active', 'draft', 'closed'];
  const filterLabels: Record<StatusFilter, string> = {
    all: 'All',
    active: 'Active',
    draft: 'Draft',
    closed: 'Closed',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px' }}>
            Jobs
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-muted)' }}>
            Manage job requisitions and track applicants
          </p>
        </div>
        <Link href="/jobs/new" style={{ textDecoration: 'none' }}>
          <Button variant="primary" size="md">
            <Plus size={16} />
            Create Job
          </Button>
        </Link>
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          background: 'rgba(var(--ink-rgb),0.03)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid rgba(var(--ink-rgb),0.07)',
          width: 'fit-content',
        }}
      >
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            style={{
              padding: '7px 16px',
              borderRadius: '7px',
              border: 'none',
              background: statusFilter === f ? 'rgba(var(--color-primary-rgb),0.2)' : 'transparent',
              color: statusFilter === f ? 'var(--color-primary-light)' : 'var(--color-muted)',
              fontWeight: statusFilter === f ? 600 : 400,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Jobs grid */}
      {isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px',
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonJobCard key={i} />)}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={24} />}
          title="No jobs found"
          subtitle={
            statusFilter === 'all'
              ? 'Create your first job requisition to get started'
              : `No ${statusFilter} jobs at the moment`
          }
          action={
            statusFilter === 'all'
              ? { label: '+ Create First Job', onClick: () => { window.location.href = '/jobs/new'; } }
              : undefined
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px',
          }}
        >
          {jobs.map((job) => <JobCard key={job.id} job={job} />)}
        </div>
      )}
    </div>
  );
}
