'use client';

import React, { useState } from 'react';
import { Bell, ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';

type TopBarProps = {
  title: string;
};

export function TopBar({ title }: TopBarProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: queueStatus } = useQuery({
    queryKey: ['queue-status'],
    queryFn: () => dashboardApi.getQueueStatus().then((r) => r.data),
    refetchInterval: 10_000,
  });

  return (
    <header
      style={{
        height: 60,
        background: 'rgba(10,11,13,0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: 700,
          color: '#F1F5F9',
          letterSpacing: '-0.2px',
        }}
      >
        {title}
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Queue Status */}
        {queueStatus && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {queueStatus.processing > 0 && (
              <span
                style={{
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#F59E0B',
                  borderRadius: '20px',
                  padding: '3px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {queueStatus.processing} processing
              </span>
            )}
            {queueStatus.failed > 0 && (
              <span
                style={{
                  background: 'rgba(244,63,94,0.12)',
                  border: '1px solid rgba(244,63,94,0.3)',
                  color: '#F43F5E',
                  borderRadius: '20px',
                  padding: '3px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {queueStatus.failed} failed
              </span>
            )}
          </div>
        )}

        {/* Notification bell */}
        <button
          style={{
            width: 36,
            height: 36,
            borderRadius: '9px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#64748B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Bell size={16} />
        </button>

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '9px',
              padding: '5px 10px 5px 6px',
              cursor: 'pointer',
              color: '#E2E8F0',
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: '13px' }}>
              {user?.fullName?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>{user?.fullName}</span>
            <ChevronDown size={14} color="#64748B" />
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '8px',
                background: '#111318',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '8px',
                minWidth: '160px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                zIndex: 100,
              }}
            >
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <User size={14} /> Profile
              </button>
              <button
                onClick={logout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#F43F5E',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
