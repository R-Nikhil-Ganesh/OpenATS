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
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: hovered
          ? '1px solid rgba(99,102,241,0.35)'
          : '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding,
        cursor: onClick ? 'pointer' : 'default',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 8px 32px rgba(99,102,241,0.15)'
          : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
