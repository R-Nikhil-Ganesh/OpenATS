'use client';

import React from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GitCompareArrows } from 'lucide-react';
import { jobsApi } from '@/lib/api';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { CompareView } from '@/components/compare/CompareView';

export default function ComparePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const a = searchParams.get('a');
  const b = searchParams.get('b');

  const { data: job } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id).then((r) => r.data),
  });

  const valid = Boolean(a && b && a !== b);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px' }}>
      <Breadcrumb
        items={[
          { label: 'Jobs', href: '/jobs' },
          { label: job?.title ?? 'Job', href: `/jobs/${id}` },
          { label: 'Compare' },
        ]}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px' }}>
            Compare Candidates
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-muted)' }}>
            Side-by-side, weighed against each other for {job?.title ?? 'this role'} by AI.
          </p>
        </div>
        <Button variant="ghost" size="md" onClick={() => router.push(`/jobs/${id}`)}>
          <ArrowLeft size={14} /> Back to candidates
        </Button>
      </div>

      {valid ? (
        <CompareView applicationIds={[a as string, b as string]} />
      ) : (
        <EmptyState
          icon={<GitCompareArrows size={26} />}
          title="Pick two candidates"
          subtitle="Select two candidates from the job's list to compare them here."
        />
      )}
    </div>
  );
}
