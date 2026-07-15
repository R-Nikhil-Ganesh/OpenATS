'use client';

import React, { useState } from 'react';
import { Bell, ChevronDown, LogOut, Moon, Sun, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { useTheme } from '@/providers/ThemeProvider';

type TopBarProps = {
  title: string;
};

export function TopBar({ title }: TopBarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
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
          color: 'var(--color-text-primary)',
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
                  background: 'rgba(var(--color-warning-rgb),0.12)',
                  border: '1px solid rgba(var(--color-warning-rgb),0.3)',
                  color: 'var(--color-warning)',
                  borderRadius: '20px',
                  padding: '3px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {queueStatus.processing} processing
              </span>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          style={{
            width: 36,
            height: 36,
            borderRadius: '9px',
            background: 'rgba(var(--ink-rgb),0.04)',
            border: '1px solid rgba(var(--ink-rgb),0.08)',
            color: 'var(--color-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* Notification bell */}
        <button
          style={{
            width: 36,
            height: 36,
            borderRadius: '9px',
            background: 'rgba(var(--ink-rgb),0.04)',
            border: '1px solid rgba(var(--ink-rgb),0.08)',
            color: 'var(--color-muted)',
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
              background: 'rgba(var(--ink-rgb),0.04)',
              border: '1px solid rgba(var(--ink-rgb),0.08)',
              borderRadius: '9px',
              padding: '5px 10px 5px 6px',
              cursor: 'pointer',
              color: 'var(--color-text-strong)',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: 'rgba(var(--color-primary-rgb),0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {user?.fullName?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>{user?.fullName}</span>
            <ChevronDown size={14} color="var(--color-muted)" />
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '8px',
                background: 'var(--color-surface)',
                border: '1px solid rgba(var(--ink-rgb),0.1)',
                borderRadius: '12px',
                padding: '8px',
                minWidth: '160px',
                boxShadow: '0 16px 40px rgba(var(--shadow-rgb),0.112)',
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
                  color: 'var(--color-muted)',
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
                  color: 'var(--color-danger)',
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
