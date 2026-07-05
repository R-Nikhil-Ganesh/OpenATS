'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { applicationsApi } from '@/lib/api';
import { CandidateSplitScreen } from '@/components/candidates/CandidateSplitScreen';

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();

  const { data: app } = useQuery({
    queryKey: ['application', id],
    queryFn: () => applicationsApi.get(id).then((r) => r.data),
  });

  const candidateName = app?.candidate?.full_name ?? 'Candidate';
  const jobId = app?.job_id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
        <Link href="/jobs" style={{ color: '#64748B', textDecoration: 'none' }}>Jobs</Link>
        <ChevronRight size={13} color="#475569" />
        {jobId && (
          <>
            <Link href={`/jobs/${jobId}`} style={{ color: '#64748B', textDecoration: 'none' }}>
              Job
            </Link>
            <ChevronRight size={13} color="#475569" />
          </>
        )}
        <span style={{ color: '#E2E8F0', fontWeight: 500 }}>{candidateName}</span>
      </nav>

      <CandidateSplitScreen applicationId={id} />
    </div>
  );
}
