'use client';

import React from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: React.ReactNode;
};

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
    color: '#fff',
    border: 'none',
    boxShadow: '0 0 20px rgba(var(--color-primary-rgb),0.35)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-muted)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'rgba(var(--color-danger-rgb), 0.12)',
    color: 'var(--color-danger)',
    border: '1px solid rgba(var(--color-danger-rgb), 0.3)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--color-primary-light)',
    border: '1px solid rgba(var(--color-primary-light-rgb),0.4)',
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: '5px 12px', fontSize: '12px', borderRadius: '7px' },
  md: { padding: '8px 18px', fontSize: '14px', borderRadius: '9px' },
  lg: { padding: '11px 24px', fontSize: '15px', borderRadius: '11px' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 600,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        opacity: isDisabled ? 0.55 : 1,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
        }
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLButtonElement).style.opacity = '1';
        props.onMouseLeave?.(e);
      }}
      onMouseDown={(e) => {
        if (!isDisabled) {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)';
        }
        props.onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
        props.onMouseUp?.(e);
      }}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
