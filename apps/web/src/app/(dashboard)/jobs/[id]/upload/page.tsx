'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { jobsApi } from '@/lib/api';
import { DropZone } from '@/components/upload/DropZone';
import { Spinner } from '@/components/ui/Spinner';

export default function UploadPage() {
  const { id } = useParams<{ id: string }>();

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id).then((r) => r.data),
  });

  return (
    <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
        <Link href="/jobs" style={{ color: '#64748B', textDecoration: 'none' }}>Jobs</Link>
        <ChevronRight size={13} color="#475569" />
        <Link href={`/jobs/${id}`} style={{ color: '#64748B', textDecoration: 'none' }}>
          {isLoading ? '...' : (job?.title ?? id)}
        </Link>
        <ChevronRight size={13} color="#475569" />
        <span style={{ color: '#E2E8F0', fontWeight: 500 }}>Upload Resumes</span>
      </nav>

      <div>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.5px' }}>
          Upload Resumes
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
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
