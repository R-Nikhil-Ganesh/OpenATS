'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { jobsApi, type Application } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users } from 'lucide-react';
import { formatScore } from '@/lib/utils';

type Tab = 'A' | 'B' | 'C';

type TierTabsProps = {
  jobId: string;
};

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div className="skeleton" style={{ height: 18, width: '60%', borderRadius: 6 }} />
      <div className="skeleton" style={{ height: 13, width: '40%', borderRadius: 6 }} />
      <div style={{ display: 'flex', gap: '6px' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 22, width: 64, borderRadius: 20 }} />
        ))}
      </div>
    </div>
  );
}

export function TierTabs({ jobId }: TierTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('A');

  const { data: appData, isLoading } = useQuery({
    queryKey: ['job-applications', jobId, activeTab],
    queryFn: () =>
      jobsApi.getApplications(jobId, { tier: activeTab }).then((r) => r.data),
  });

  const tabs: Tab[] = ['A', 'B', 'C'];

  const { data: allCounts } = useQuery({
    queryKey: ['job-applications-counts', jobId],
    queryFn: async () => {
      const [a, b, c] = await Promise.all([
        jobsApi.getApplications(jobId, { tier: 'A' }).then((r) => r.data.applications.length),
        jobsApi.getApplications(jobId, { tier: 'B' }).then((r) => r.data.applications.length),
        jobsApi.getApplications(jobId, { tier: 'C' }).then((r) => r.data.applications.length),
      ]);
      return { A: a, B: b, C: c };
    },
  });

  const tabColors: Record<Tab, string> = {
    A: '#10B981',
    B: '#F59E0B',
    C: '#64748B',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Tab headers */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          background: 'rgba(255,255,255,0.03)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.07)',
          width: 'fit-content',
          position: 'relative',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          const count = allCounts?.[tab] ?? 0;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                position: 'relative',
                padding: '8px 20px',
                borderRadius: '7px',
                border: 'none',
                background: isActive ? tabColors[tab] + '1A' : 'transparent',
                color: isActive ? tabColors[tab] : '#64748B',
                fontWeight: isActive ? 700 : 500,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-underline"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '7px',
                    border: `1px solid ${tabColors[tab]}40`,
                    background: `${tabColors[tab]}12`,
                  }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>Tier {tab}</span>
              <span
                style={{
                  position: 'relative',
                  zIndex: 1,
                  background: isActive ? tabColors[tab] + '25' : 'rgba(255,255,255,0.06)',
                  color: isActive ? tabColors[tab] : '#64748B',
                  padding: '1px 7px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '14px',
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : !appData?.applications.length ? (
            <EmptyState
              icon={<Users size={24} />}
              title={`No Tier ${activeTab} candidates yet`}
              subtitle="Upload resumes to start processing applicants"
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '14px',
              }}
            >
              {appData.applications.map((app, i) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <CandidateCard app={app} tabColor={tabColors[activeTab]} />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CandidateCard({
  app,
  tabColor,
}: {
  app: Application;
  tabColor: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  const skills = app.ai_analysis?.matched_skills?.slice(0, 3) ?? [];
  const name = app.candidate?.full_name ?? 'Unknown Candidate';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: hovered ? `1px solid ${tabColor}40` : '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 6px 24px ${tabColor}18` : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#F1F5F9' }}>
            {name}
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
            {app.candidate?.email}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <Badge tier={app.tier ?? undefined} />
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: tabColor,
            }}
          >
            {formatScore(app.score)}
          </span>
        </div>
      </div>

      {skills.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {skills.map((s) => (
            <span
              key={s.skill}
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '20px',
                background: 'rgba(99,102,241,0.1)',
                color: '#818CF8',
                border: '1px solid rgba(99,102,241,0.2)',
              }}
            >
              {s.skill}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link href={`/candidates/${app.id}`} style={{ textDecoration: 'none' }}>
          <Button variant="outline" size="sm">
            Review
          </Button>
        </Link>
      </div>
    </div>
  );
}
