'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { jobsApi } from '@/lib/api';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();

  const { data: job } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id).then((r) => r.data),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
        <Link href="/jobs" style={{ color: '#64748B', textDecoration: 'none' }}>Jobs</Link>
        <ChevronRight size={13} color="#475569" />
        <Link href={`/jobs/${id}`} style={{ color: '#64748B', textDecoration: 'none' }}>
          {job?.title ?? id}
        </Link>
        <ChevronRight size={13} color="#475569" />
        <span style={{ color: '#E2E8F0', fontWeight: 500 }}>Workflow Board</span>
      </nav>

      <div>
        <h1
          style={{
            margin: '0 0 6px',
            fontSize: '24px',
            fontWeight: 800,
            color: '#F1F5F9',
            letterSpacing: '-0.5px',
          }}
        >
          {job?.title ?? 'Workflow Board'}
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
          Drag candidates between stages to update their recruitment status
        </p>
      </div>

      <KanbanBoard jobId={id} />
    </div>
  );
}
