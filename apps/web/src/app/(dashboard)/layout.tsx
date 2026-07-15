'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Spinner } from '@/components/ui/Spinner';
import { isAuthenticated } from '@/lib/auth';
import { SSEProvider } from '@/providers/SSEProvider';

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
          background: 'var(--color-bg)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.4px',
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
    <SSEProvider>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          overflow: 'hidden',
          background: 'var(--color-bg)',
        }}
      >
        <Sidebar />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            overflow: 'hidden',
          }}
        >
          <TopBar title="OpenATS" />
          <main
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: '28px',
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </SSEProvider>
  );
}
