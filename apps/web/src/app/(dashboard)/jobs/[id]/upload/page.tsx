'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api';
import { DropZone } from '@/components/upload/DropZone';
import { Spinner } from '@/components/ui/Spinner';
import { Breadcrumb } from '@/components/layout/Breadcrumb';

export default function UploadPage() {
  const { id } = useParams<{ id: string }>();

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id).then((r) => r.data),
  });

  return (
    <div
      style={{
        maxWidth: 720,
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <Breadcrumb
        items={[
          { label: 'Jobs', href: '/jobs' },
          { label: isLoading ? undefined : (job?.title ?? id), href: `/jobs/${id}` },
          { label: 'Upload Resumes' },
        ]}
      />

      <div>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px' }}>
          Upload Resumes
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-muted)' }}>
          Drop PDF resumes below. They will be automatically processed and ranked by AI.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <Spinner size="md" />
        </div>
      ) : (
        <DropZone jobId={id} />
      )}
    </div>
  );
}
