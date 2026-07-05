'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32);
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    tenantName: '',
    tenantSlug: '',
    fullName: '',
    email: '',
    password: '',
  });
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    if (!slugEdited) {
      setForm((prev) => ({ ...prev, tenantSlug: slugify(prev.tenantName) }));
    }
  }, [form.tenantName, slugEdited]);

  const mutation = useMutation({
    mutationFn: () => authApi.registerTenant(form),
    onSuccess: () => router.push('/login'),
  });

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (field === 'tenantSlug') setSlugEdited(true);
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

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
        padding: '24px',
      }}
    >
      <div className="bg-grid" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
      <div className="blob blob-1" />
      <div className="blob blob-2" />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '480px',
        }}
      >
        <div
          style={{
            background: 'rgba(17,19,24,0.9)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '40px 36px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h1
              style={{
                fontSize: '32px',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #6366F1, #818CF8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-1px',
                marginBottom: '6px',
              }}
            >
              openats
            </h1>
            <p style={{ fontSize: '14px', color: '#64748B' }}>Create your organization</p>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <Input
              label="Company Name"
              placeholder="Acme Corporation"
              value={form.tenantName}
              onChange={set('tenantName')}
              required
            />

            <div>
              <Input
                label="Company Slug"
                placeholder="acme-corporation"
                value={form.tenantSlug}
                onChange={set('tenantSlug')}
                required
              />
              <p style={{ marginTop: '4px', fontSize: '11px', color: '#64748B' }}>
                Your URL: openats.app/<strong style={{ color: '#818CF8' }}>{form.tenantSlug || 'your-slug'}</strong>
              </p>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

            <Input
              label="Your Name"
              placeholder="Jane Doe"
              value={form.fullName}
              onChange={set('fullName')}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="jane@acme.com"
              value={form.email}
              onChange={set('email')}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              required
            />

            {mutation.isError && (
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
                Registration failed. Please try again.
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={mutation.isPending}
              style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
            >
              Create Organization
            </Button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#64748B' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: '#818CF8', textDecoration: 'none', fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
