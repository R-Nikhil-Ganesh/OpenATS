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
        background: '#0A0B0D',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background grid */}
      <div
        className="bg-grid"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.5,
        }}
      />

      {/* Animated blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      {/* Login card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '420px',
          padding: '24px',
        }}
      >
        <div
          style={{
            background: 'rgba(17,19,24,0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '40px 36px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1
              style={{
                fontSize: '36px',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #6366F1, #818CF8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-1.5px',
                marginBottom: '8px',
              }}
            >
              openats
            </h1>
            <p style={{ fontSize: '14px', color: '#64748B', letterSpacing: '0.02em' }}>
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
                  background: 'rgba(244,63,94,0.08)',
                  border: '1px solid rgba(244,63,94,0.25)',
                  borderRadius: '9px',
                  fontSize: '13px',
                  color: '#F43F5E',
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
