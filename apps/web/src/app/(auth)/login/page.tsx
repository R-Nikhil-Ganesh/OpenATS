'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();

  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(form);
      router.push('/');
    } catch {
      setError('Invalid credentials. Please check your details and try again.');
    }
  };

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        position: 'relative',
      }}
    >
      {/* Login card */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '24px',
        }}
      >
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '20px',
            padding: '40px 36px',
            boxShadow: '0 12px 32px rgba(var(--ink-rgb),0.08)',
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1
              style={{
                fontSize: '36px',
                fontWeight: 900,
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-1.5px',
                marginBottom: '8px',
              }}
            >
              openats
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-muted)', letterSpacing: '0.02em' }}>
              AI-Powered Recruiting Intelligence
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >

            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
            />
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              autoComplete="current-password"
            />

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(var(--color-danger-rgb),0.08)',
                  border: '1px solid rgba(var(--color-danger-rgb),0.25)',
                  borderRadius: '9px',
                  fontSize: '13px',
                  color: 'var(--color-danger)',
                }}
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
            >
              Sign In
            </Button>
          </form>


        </div>
      </div>
    </div>
  );
}
