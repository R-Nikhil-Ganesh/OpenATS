'use client';

import React from 'react';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  style?: React.CSSProperties;
  padding?: string;
};

export function Card({
  children,
  onClick,
  hoverable = false,
  style,
  padding = '24px',
}: CardProps) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hoverable && setHovered(true)}
      onMouseLeave={() => hoverable && setHovered(false)}
      style={{
        background: 'var(--color-surface)',
        border: hovered
          ? '1px solid rgba(var(--color-primary-rgb),0.35)'
          : '1px solid var(--color-border)',
        borderRadius: '12px',
        padding,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 8px 32px rgba(var(--color-primary-rgb),0.15)'
          : '0 2px 8px rgba(var(--shadow-rgb),0.056)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
