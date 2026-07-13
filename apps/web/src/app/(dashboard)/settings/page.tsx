'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Settings as SettingsIcon } from 'lucide-react';
import { ModelSettingsCard } from '@/components/settings/ModelSettingsCard';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <SettingsIcon size={24} color="var(--color-muted)" />
        <h1
          style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.5px',
          }}
        >
          Settings
        </h1>
      </div>

      <div
        style={{
          background: 'rgba(var(--ink-rgb),0.02)',
          border: '1px solid rgba(var(--ink-rgb),0.06)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-strong)' }}>
          Profile Settings
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-muted)', marginBottom: '4px' }}>Name</label>
            <div style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{user?.fullName || 'N/A'}</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-muted)', marginBottom: '4px' }}>Email</label>
            <div style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{user?.email || 'N/A'}</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--color-muted)', marginBottom: '4px' }}>Role</label>
            <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>{user?.role || 'N/A'}</div>
          </div>
        </div>
        
      </div>

      <ModelSettingsCard />
    </div>
  );
}
