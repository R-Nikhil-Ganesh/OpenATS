'use client';

import React from 'react';
import { tierColor, tierBg, statusColor } from '@/lib/utils';

type BadgeProps = {
  tier?: 'A' | 'B' | 'C' | string;
  status?: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md';
};

export function Badge({ tier, status, children, size = 'md' }: BadgeProps) {
  let color = '#64748B';
  let bg = 'rgba(100, 116, 139, 0.12)';
  let label = children;

  if (tier) {
    color = tierColor(tier);
    bg = tierBg(tier);
    label = label ?? `Tier ${tier}`;
  } else if (status) {
    color = statusColor(status);
    bg = `${statusColor(status)}1F`;
    label = label ?? status.charAt(0).toUpperCase() + status.slice(1);
  }

  const padding = size === 'sm' ? '2px 7px' : '3px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding,
        borderRadius: '20px',
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.02em',
        color,
        backgroundColor: bg,
        border: `1px solid ${color}33`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
