'use client';

import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, id, style, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const [focused, setFocused] = React.useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-muted)',
            letterSpacing: '0.02em',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={{
          background: 'rgba(var(--ink-rgb),0.04)',
          border: error
            ? '1px solid var(--color-danger)'
            : focused
            ? '1px solid var(--color-primary)'
            : '1px solid rgba(var(--ink-rgb),0.1)',
          borderRadius: '9px',
          padding: '10px 14px',
          color: 'var(--color-text-primary)',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: focused ? '0 0 0 3px rgba(var(--color-primary-rgb),0.15)' : 'none',
          width: '100%',
          boxSizing: 'border-box',
          ...style,
        }}
      />
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{error}</span>
      )}
    </div>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export function Textarea({ label, error, id, style, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const [focused, setFocused] = React.useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-muted)' }}
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={{
          background: 'rgba(var(--ink-rgb),0.04)',
          border: error
            ? '1px solid var(--color-danger)'
            : focused
            ? '1px solid var(--color-primary)'
            : '1px solid rgba(var(--ink-rgb),0.1)',
          borderRadius: '9px',
          padding: '10px 14px',
          color: 'var(--color-text-primary)',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: focused ? '0 0 0 3px rgba(var(--color-primary-rgb),0.15)' : 'none',
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          fontFamily: 'inherit',
          ...style,
        }}
      />
      {error && <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{error}</span>}
    </div>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
};

export function Select({ label, error, id, options, style, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const [focused, setFocused] = React.useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-muted)' }}
        >
          {label}
        </label>
      )}
      <select
        id={inputId}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={{
          background: 'var(--color-surface)',
          border: error
            ? '1px solid var(--color-danger)'
            : focused
            ? '1px solid var(--color-primary)'
            : '1px solid var(--color-border)',
          borderRadius: '9px',
          padding: '10px 34px 10px 14px',
          color: 'var(--color-text-primary)',
          fontSize: '14px',
          outline: 'none',
          width: '100%',
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgb(148,163,184)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          ...style,
        }}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
            }}
          >
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{error}</span>}
    </div>
  );
}
