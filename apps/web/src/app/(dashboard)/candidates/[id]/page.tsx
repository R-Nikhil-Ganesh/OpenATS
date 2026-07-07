'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { applicationsApi } from '@/lib/api';
import { CandidateSplitScreen } from '@/components/candidates/CandidateSplitScreen';
import { Breadcrumb, type BreadcrumbItem } from '@/components/layout/Breadcrumb';

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();

  const { data: app, isLoading } = useQuery({
    queryKey: ['application', id],
    queryFn: () => applicationsApi.get(id).then((r) => r.data),
  });

  const jobId = app?.job_id;

  const items: BreadcrumbItem[] = [{ label: 'Jobs', href: '/jobs' }];
  if (jobId) items.push({ label: 'Job', href: `/jobs/${jobId}` });
  items.push({ label: isLoading ? undefined : (app?.candidate?.full_name ?? 'Candidate') });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Breadcrumb items={items} />

      <CandidateSplitScreen applicationId={id} />
    </div>
  );
}
