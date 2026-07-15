'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  History,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Jobs', href: '/jobs', icon: Briefcase },
  { label: 'Role History', href: '/role-history', icon: History },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/** Square accent tile used as the collapsed-state logo mark. */
function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 7,
        background: 'var(--color-primary)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size <= 22 ? 12 : 14,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        flexShrink: 0,
      }}
    >
      oA
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const width = collapsed ? 72 : 240;

  return (
    <aside
      style={{
        width,
        minWidth: width,
        height: '100vh',
        background: 'var(--color-surface-3)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        style={{
          padding: collapsed ? '18px 0' : '18px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
          minHeight: 64,
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        {collapsed ? (
          <LogoMark size={32} />
        ) : (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.3px',
            }}
          >
            <LogoMark size={26} />
            openats
          </span>
        )}
        {!collapsed && (
          <button
            aria-label="Collapse sidebar"
            onClick={() => setCollapsed(true)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--color-text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(var(--ink-rgb),0.06)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 7,
                textDecoration: 'none',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                background: isActive ? 'rgba(var(--ink-rgb),0.06)' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: 13.5,
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(var(--ink-rgb),0.035)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    left: collapsed ? 6 : 0,
                    top: 8,
                    bottom: 8,
                    width: 2,
                    borderRadius: 2,
                    background: 'var(--color-primary)',
                  }}
                />
              )}
              <Icon
                size={17}
                strokeWidth={isActive ? 2.2 : 1.8}
                style={{ flexShrink: 0, color: isActive ? 'var(--color-primary)' : 'currentColor' }}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {collapsed && (
          <button
            aria-label="Expand sidebar"
            onClick={() => setCollapsed(false)}
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 0',
              borderRadius: 7,
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(var(--ink-rgb),0.035)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <PanelLeftOpen size={17} />
          </button>
        )}
      </nav>

      {/* Bottom user section */}
      {user && (
        <div
          style={{
            padding: collapsed ? '14px 0' : '14px 14px',
            borderTop: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 7,
              background: 'rgba(var(--color-primary-rgb),0.12)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.fullName}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                  textTransform: 'capitalize',
                }}
              >
                {user.role}
              </p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
