'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, LayoutDashboard } from 'lucide-react';

export type BreadcrumbItem = {
  /** Pass undefined while the label is still loading — renders a placeholder. */
  label?: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumb({ items }: BreadcrumbProps) {
  const allItems: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/' }, ...items];

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
      {allItems.map((item, i) => {
        const isLast = i === allItems.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={13} color="var(--color-text-muted)" />}
            {i === 0 && <LayoutDashboard size={13} color="var(--color-muted)" />}
            {item.label === undefined ? (
              <span
                style={{
                  color: 'var(--color-text-muted)',
                  width: '60px',
                  height: '13px',
                  borderRadius: '4px',
                  background: 'rgba(var(--ink-rgb),0.06)',
                  display: 'inline-block',
                }}
              />
            ) : !isLast && item.href ? (
              <Link href={item.href} style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>
                {item.label}
              </Link>
            ) : (
              <span
                style={{
                  color: 'var(--color-text-strong)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '360px',
                }}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
