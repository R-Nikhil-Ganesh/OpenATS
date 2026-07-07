'use client';

import React from 'react';
import { tierColor, tierBg, tierRgb, statusColor, statusRgb } from '@/lib/utils';

type BadgeProps = {
  tier?: 'A' | 'B' | 'C' | string;
  status?: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md';
};

export function Badge({ tier, status, children, size = 'md' }: BadgeProps) {
  let color = 'var(--color-muted)';
  let bg = 'rgba(var(--color-muted-rgb), 0.12)';
  let rgb = 'var(--color-muted-rgb)';
  let label = children;

  if (tier) {
    color = tierColor(tier);
    bg = tierBg(tier);
    rgb = tierRgb(tier);
    label = label ?? `Tier ${tier}`;
  } else if (status) {
    color = statusColor(status);
    rgb = statusRgb(status);
    bg = `rgba(${rgb}, 0.12)`;
    label = label ?? status.charAt(0).toUpperCase() + status.slice(1);
  }

  const padding = size === 'sm' ? '2px 7px' : '3px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      title={typeof label === 'string' ? label : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: '100%',
        padding,
        borderRadius: '20px',
        fontSize,
        fontWeight: 600,
        letterSpacing: '0.02em',
        color,
        backgroundColor: bg,
        border: `1px solid rgba(${rgb}, 0.2)`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {label}
    </span>
  );
}
