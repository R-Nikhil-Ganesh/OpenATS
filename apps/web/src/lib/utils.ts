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
    case 'A': return '#10B981';
    case 'B': return '#F59E0B';
    case 'C': return '#64748B';
    default: return '#64748B';
  }
}

export function tierBg(tier: 'A' | 'B' | 'C' | string | null | undefined): string {
  switch (tier) {
    case 'A': return 'rgba(16, 185, 129, 0.12)';
    case 'B': return 'rgba(245, 158, 11, 0.12)';
    case 'C': return 'rgba(100, 116, 139, 0.12)';
    default: return 'rgba(100, 116, 139, 0.12)';
  }
}

export function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'applied': return '#6366F1';
    case 'screening': return '#818CF8';
    case 'interviewing': return '#F59E0B';
    case 'hired': return '#10B981';
    case 'rejected': return '#F43F5E';
    case 'queued': return '#64748B';
    case 'extracting': return '#6366F1';
    case 'scoring': return '#F59E0B';
    case 'completed': return '#10B981';
    case 'failed': return '#F43F5E';
    default: return '#64748B';
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
