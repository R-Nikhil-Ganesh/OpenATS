'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { Breadcrumb } from '@/components/layout/Breadcrumb';

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id).then((r) => r.data),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Breadcrumb
        items={[
          { label: 'Jobs', href: '/jobs' },
          { label: isLoading ? undefined : (job?.title ?? id), href: `/jobs/${id}` },
          { label: 'Workflow Board' },
        ]}
      />

      <div>
        <h1
          style={{
            margin: '0 0 6px',
            fontSize: '24px',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.5px',
          }}
        >
          {job?.title ?? 'Workflow Board'}
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-muted)' }}>
          Drag candidates between stages to update their recruitment status
        </p>
      </div>

      <KanbanBoard jobId={id} />
    </div>
  );
}
