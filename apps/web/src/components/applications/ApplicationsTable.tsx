'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Users, GitCompareArrows, X, Trash2 } from 'lucide-react';
import { jobsApi, applicationsApi, type Application } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProfileLinks } from '@/components/ui/ProfileLinks';
import { CandidateProfileModal } from '@/components/candidates/CandidateProfileModal';
import { formatScore, formatRelative } from '@/lib/utils';

type SortKey = 'name' | 'tier' | 'score' | 'status' | 'applied_at';
type SortDir = 'asc' | 'desc';

type Props = {
  jobId: string;
};

const TIER_FILTERS: ('all' | 'A' | 'B' | 'C')[] = ['all', 'A', 'B', 'C'];

const TIER_RANK: Record<string, number> = { A: 3, B: 2, C: 1 };

export function ApplicationsTable({ jobId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tierFilter, setTierFilter] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  // Application ids selected for head-to-head comparison (max 2).
  const [selected, setSelected] = useState<string[]>([]);
  // Application whose profile is currently open in the quick-view modal.
  const [profileApp, setProfileApp] = useState<Application | null>(null);
  // Application pending delete confirmation.
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => applicationsApi.delete(id),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['job-applications-all', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-stats', jobId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev; // cap at two
      return [...prev, id];
    });
  };

  const { data: apps, isLoading } = useQuery({
    queryKey: ['job-applications-all', jobId],
    queryFn: () => jobsApi.getApplications(jobId).then((r) => r.data.applications),
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const rows = useMemo(() => {
    let list = apps ?? [];

    if (tierFilter !== 'all') {
      list = list.filter((a) => a.tier === tierFilter);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const name = a.candidate?.full_name?.toLowerCase() ?? '';
        const email = a.candidate?.email?.toLowerCase() ?? '';
        const skills = a.ai_analysis?.matched_skills?.map((s: { skill: string }) => s.skill.toLowerCase()).join(' ') ?? '';
        const profileSkills = a.profile?.skills?.join(' ').toLowerCase() ?? '';
        return name.includes(q) || email.includes(q) || skills.includes(q) || profileSkills.includes(q);
      });
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * (a.candidate?.full_name ?? '').localeCompare(b.candidate?.full_name ?? '');
        case 'tier':
          return dir * ((TIER_RANK[a.tier ?? ''] ?? 0) - (TIER_RANK[b.tier ?? ''] ?? 0));
        case 'score':
          return dir * ((a.score ?? -1) - (b.score ?? -1));
        case 'status':
          return dir * (a.status ?? '').localeCompare(b.status ?? '');
        case 'applied_at':
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        default:
          return 0;
      }
    });
  }, [apps, tierFilter, query, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!apps || apps.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        title="No candidates yet"
        subtitle="Upload resumes to start processing applicants"
      />
    );
  }

  const SortHeader = ({ label, sortableKey }: { label: string; sortableKey: SortKey }) => (
    <th
      onClick={() => toggleSort(sortableKey)}
      style={{
        textAlign: 'left',
        padding: '10px 14px',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--color-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {label}
        {sortKey === sortableKey ? (
          sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} style={{ opacity: 0.4 }} />
        )}
      </span>
    </th>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(var(--ink-rgb),0.03)', padding: '3px', borderRadius: '9px', border: '1px solid rgba(var(--ink-rgb),0.07)' }}>
          {TIER_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: tierFilter === t ? 'rgba(var(--color-primary-rgb),0.15)' : 'transparent',
                color: tierFilter === t ? 'var(--color-primary-light)' : 'var(--color-muted)',
                fontWeight: tierFilter === t ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {t === 'all' ? 'All' : `Tier ${t}`}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Search size={14} color="var(--color-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, or skill…"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 12px 8px 32px',
              fontSize: '13px',
              color: 'var(--color-text-strong)',
              background: 'rgba(var(--ink-rgb),0.03)',
              border: '1px solid rgba(var(--ink-rgb),0.08)',
              borderRadius: '9px',
              outline: 'none',
            }}
          />
        </div>

        <span style={{ fontSize: '12px', color: 'var(--color-muted)', marginLeft: 'auto' }}>
          {rows.length} of {apps.length}
        </span>
      </div>

      {/* Table */}
      <div
        style={{
          border: '1px solid rgba(var(--ink-rgb),0.08)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {rows.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--color-muted)', fontSize: '13px' }}>
            No candidates match your filters.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead style={{ background: 'rgba(var(--ink-rgb),0.02)', borderBottom: '1px solid rgba(var(--ink-rgb),0.07)' }}>
                <tr>
                  <th style={{ width: 40, padding: '10px 0 10px 14px' }} />
                  <SortHeader label="Candidate" sortableKey="name" />
                  <SortHeader label="Tier" sortableKey="tier" />
                  <SortHeader label="Score" sortableKey="score" />
                  <SortHeader label="Status" sortableKey="status" />
                  <SortHeader label="Applied" sortableKey="applied_at" />
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((app, i) => {
                  const isSelected = selected.includes(app.id);
                  const selectDisabled = !isSelected && selected.length >= 2;
                  return (
                  <tr
                    key={app.id}
                    onClick={() => router.push(`/candidates/${app.id}`)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(var(--color-primary-rgb),0.06)' : 'transparent',
                      borderBottom: i < rows.length - 1 ? '1px solid rgba(var(--ink-rgb),0.05)' : 'none',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(var(--ink-rgb),0.025)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? 'rgba(var(--color-primary-rgb),0.06)' : 'transparent'; }}
                  >
                    <td
                      style={{ padding: '12px 0 12px 14px' }}
                      onClick={(e) => { e.stopPropagation(); if (!selectDisabled) toggleSelect(app.id); }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={selectDisabled}
                        onChange={() => {}}
                        title={selectDisabled ? 'Deselect one to pick a different candidate' : 'Select to compare'}
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: 'var(--color-primary)',
                          cursor: selectDisabled ? 'not-allowed' : 'pointer',
                          verticalAlign: 'middle',
                        }}
                      />
                    </td>
                    <td style={{ padding: '12px 14px', minWidth: 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            onClick={(e) => { e.stopPropagation(); setProfileApp(app); }}
                            style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220, cursor: 'pointer' }}
                            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                          >
                            {app.candidate?.full_name ?? 'Unknown'}
                          </span>
                          <ProfileLinks links={app.profile?.links} size={12} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                          {app.candidate?.email}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {app.tier ? <Badge tier={app.tier} size="sm" /> : <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-body)', whiteSpace: 'nowrap' }}>
                      {formatScore(app.score)}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Badge status={app.status} size="sm" />
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                      {formatRelative(app.created_at)}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(app); }}
                        title="Delete application"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-muted)'; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating compare action bar */}
      {selected.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '10px 12px 10px 18px',
            background: 'var(--color-surface)',
            border: '1px solid rgba(var(--ink-rgb),0.12)',
            borderRadius: '14px',
            boxShadow: '0 16px 40px rgba(var(--shadow-rgb),0.18)',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--color-text-strong)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {selected.length === 1 ? '1 selected · pick 1 more' : '2 candidates selected'}
          </span>
          <button
            onClick={() => setSelected([])}
            title="Clear selection"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-muted)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px 6px',
            }}
          >
            <X size={13} /> Clear
          </button>
          <button
            disabled={selected.length !== 2}
            onClick={() => router.push(`/jobs/${jobId}/compare?a=${selected[0]}&b=${selected[1]}`)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '9px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))',
              boxShadow: selected.length === 2 ? '0 0 20px rgba(var(--color-primary-rgb),0.35)' : 'none',
              cursor: selected.length === 2 ? 'pointer' : 'not-allowed',
              opacity: selected.length === 2 ? 1 : 0.5,
              transition: 'all 0.15s ease',
            }}
          >
            <GitCompareArrows size={15} /> Compare
          </button>
        </div>
      )}

      <CandidateProfileModal
        open={!!profileApp}
        onClose={() => setProfileApp(null)}
        name={profileApp?.candidate?.full_name ?? 'Unknown'}
        profile={profileApp?.profile}
        tier={profileApp?.tier}
        score={profileApp?.score}
        viewHref={profileApp ? `/candidates/${profileApp.id}` : undefined}
      />

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this application?"
        width="440px"
      >
        <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--color-text-body)', lineHeight: 1.6 }}>
          This permanently removes {deleteTarget?.candidate?.full_name ?? 'this candidate'}&rsquo;s
          application, AI evaluation, and resume file from disk. This can&rsquo;t be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button variant="ghost" size="md" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            loading={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
