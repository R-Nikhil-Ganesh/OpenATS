'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, Briefcase, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { FunnelChart } from '@/components/dashboard/FunnelChart';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { dashboardApi } from '@/lib/api';
import { formatRelative } from '@/lib/utils';

export default function DashboardPage() {
  const { data } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.getSummary().then((r) => r.data),
  });

  const recentJobs = data?.recent_jobs ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.5px' }}>
            Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
            AI-powered recruiting intelligence at a glance
          </p>
        </div>
        <Link href="/jobs/new" style={{ textDecoration: 'none' }}>
          <Button variant="primary" size="md">
            <Plus size={16} />
            New Job
          </Button>
        </Link>
      </div>

      {/* Stats grid */}
      <StatsGrid />

      {/* Charts + recent activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
        <FunnelChart />

        {/* Recent Jobs */}
        <Card padding="24px">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#F1F5F9' }}>
              Recent Jobs
            </h3>
            <Link href="/jobs" style={{ textDecoration: 'none' }}>
              <span
                style={{
                  fontSize: '12px',
                  color: '#818CF8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                View all <ArrowRight size={12} />
              </span>
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentJobs.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <Briefcase size={24} color="#334155" style={{ marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                  No jobs yet.{' '}
                  <Link href="/jobs/new" style={{ color: '#818CF8' }}>
                    Create your first job
                  </Link>
                </p>
              </div>
            ) : (
              recentJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.05)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '10px',
                        background: 'rgba(99,102,241,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6366F1',
                        flexShrink: 0,
                      }}
                    >
                      <Briefcase size={16} />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <p
                        style={{
                          margin: '0 0 2px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#E2E8F0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {job.title}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>
                        {job.department} · {formatRelative(job.created_at)}
                      </p>
                    </div>
                    <Badge status={job.status} size="sm" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
