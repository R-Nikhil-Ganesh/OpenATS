import { clsx, type ClassValue } from 'clsx';
import { formatDistanceToNow, format } from 'date-fns';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function tierColor(tier: 'A' | 'B' | 'C' | string | null | undefined): string {
  switch (tier) {
    case 'A': return 'var(--color-success)';
    case 'B': return 'var(--color-warning)';
    case 'C': return 'var(--color-muted)';
    default: return 'var(--color-muted)';
  }
}

export function tierBg(tier: 'A' | 'B' | 'C' | string | null | undefined): string {
  switch (tier) {
    case 'A': return 'rgba(var(--color-success-rgb), 0.12)';
    case 'B': return 'rgba(var(--color-warning-rgb), 0.12)';
    case 'C': return 'rgba(var(--color-muted-rgb), 0.12)';
    default: return 'rgba(var(--color-muted-rgb), 0.12)';
  }
}

/** Bare `--color-x-rgb` reference for building a custom-alpha rgba() at the
 * call site (e.g. borders) — can't string-concat an alpha suffix onto a
 * var() reference the way you could with a literal hex color. */
export function tierRgb(tier: 'A' | 'B' | 'C' | string | null | undefined): string {
  switch (tier) {
    case 'A': return 'var(--color-success-rgb)';
    case 'B': return 'var(--color-warning-rgb)';
    case 'C': return 'var(--color-muted-rgb)';
    default: return 'var(--color-muted-rgb)';
  }
}

export function statusRgb(status: string | null | undefined): string {
  switch (status) {
    case 'applied': return 'var(--color-primary-rgb)';
    case 'screening': return 'var(--color-primary-light-rgb)';
    case 'interviewing': return 'var(--color-warning-rgb)';
    case 'hired': return 'var(--color-success-rgb)';
    case 'rejected': return 'var(--color-danger-rgb)';
    case 'queued': return 'var(--color-muted-rgb)';
    case 'extracting': return 'var(--color-primary-rgb)';
    case 'scoring': return 'var(--color-warning-rgb)';
    case 'completed': return 'var(--color-success-rgb)';
    case 'failed': return 'var(--color-danger-rgb)';
    default: return 'var(--color-muted-rgb)';
  }
}

export function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'applied': return 'var(--color-primary)';
    case 'screening': return 'var(--color-primary-light)';
    case 'interviewing': return 'var(--color-warning)';
    case 'hired': return 'var(--color-success)';
    case 'rejected': return 'var(--color-danger)';
    case 'queued': return 'var(--color-muted)';
    case 'extracting': return 'var(--color-primary)';
    case 'scoring': return 'var(--color-warning)';
    case 'completed': return 'var(--color-success)';
    case 'failed': return 'var(--color-danger)';
    default: return 'var(--color-muted)';
  }
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '…';
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—';
  return `${Math.round(score)}/100`;
}
