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
            color: '#94A3B8',
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
          background: 'rgba(255,255,255,0.04)',
          border: error
            ? '1px solid #F43F5E'
            : focused
            ? '1px solid #6366F1'
            : '1px solid rgba(255,255,255,0.1)',
          borderRadius: '9px',
          padding: '10px 14px',
          color: '#F1F5F9',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
          width: '100%',
          boxSizing: 'border-box',
          ...style,
        }}
      />
      {error && (
        <span style={{ fontSize: '12px', color: '#F43F5E' }}>{error}</span>
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
          style={{ fontSize: '13px', fontWeight: 500, color: '#94A3B8' }}
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
          background: 'rgba(255,255,255,0.04)',
          border: error
            ? '1px solid #F43F5E'
            : focused
            ? '1px solid #6366F1'
            : '1px solid rgba(255,255,255,0.1)',
          borderRadius: '9px',
          padding: '10px 14px',
          color: '#F1F5F9',
          fontSize: '14px',
          outline: 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          fontFamily: 'inherit',
          ...style,
        }}
      />
      {error && <span style={{ fontSize: '12px', color: '#F43F5E' }}>{error}</span>}
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
          style={{ fontSize: '13px', fontWeight: 500, color: '#94A3B8' }}
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
          background: '#111318',
          border: error
            ? '1px solid #F43F5E'
            : focused
            ? '1px solid #6366F1'
            : '1px solid rgba(255,255,255,0.1)',
          borderRadius: '9px',
          padding: '10px 14px',
          color: '#F1F5F9',
          fontSize: '14px',
          outline: 'none',
          width: '100%',
          cursor: 'pointer',
          ...style,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span style={{ fontSize: '12px', color: '#F43F5E' }}>{error}</span>}
    </div>
  );
}
