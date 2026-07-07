'use client';

import React from 'react';
import { Button } from './Button';

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 32px',
        gap: '16px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: 'rgba(var(--color-primary-rgb),0.1)',
          border: '1px solid rgba(var(--color-primary-rgb),0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-primary)',
        }}
      >
        {icon}
      </div>
      <div>
        <p
          style={{
            margin: '0 0 6px',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--color-text-strong)',
          }}
        >
          {title}
        </p>
        {subtitle && (
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-muted)' }}>{subtitle}</p>
        )}
      </div>
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
