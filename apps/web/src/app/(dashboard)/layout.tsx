'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Spinner } from '@/components/ui/Spinner';
import { isAuthenticated } from '@/lib/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, isError } = useAuth();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [router]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0B0D',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              fontSize: '28px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #6366F1, #818CF8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-1px',
            }}
          >
            openats
          </span>
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  if (isError) {
    router.replace('/login');
    return null;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0B0D' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar title="OpenATS" />
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '28px',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
