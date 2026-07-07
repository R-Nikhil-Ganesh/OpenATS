'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <SettingsIcon size={24} color="#64748B" />
        <h1
          style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 800,
            color: '#F1F5F9',
            letterSpacing: '-0.5px',
          }}
        >
          Settings
        </h1>
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#E2E8F0' }}>
          Profile Settings
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '4px' }}>Name</label>
            <div style={{ fontSize: '14px', color: '#F1F5F9' }}>{user?.fullName || 'N/A'}</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '4px' }}>Email</label>
            <div style={{ fontSize: '14px', color: '#F1F5F9' }}>{user?.email || 'N/A'}</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '4px' }}>Role</label>
            <div style={{ fontSize: '14px', color: '#F1F5F9', textTransform: 'capitalize' }}>{user?.role || 'N/A'}</div>
          </div>
        </div>
        
        <p style={{ marginTop: '24px', fontSize: '13px', color: '#64748B' }}>
          More settings configurations will be available in a future update.
        </p>
      </div>
    </div>
  );
}
