'use client';

import React from 'react';

type Size = 'sm' | 'md' | 'lg';

const sizeMap: Record<Size, number> = {
  sm: 14,
  md: 20,
  lg: 32,
};

type SpinnerProps = {
  size?: Size;
  color?: string;
};

export function Spinner({ size = 'md', color = 'var(--color-primary)' }: SpinnerProps) {
  const px = sizeMap[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        animation: 'spin 0.75s linear infinite',
        flexShrink: 0,
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeOpacity={0.3}
        strokeWidth="2.5"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
