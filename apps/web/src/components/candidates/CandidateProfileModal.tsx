'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ResumeProfile } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ProfileDetails } from './ProfileDetails';
import { formatScore } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  profile?: ResumeProfile;
  tier?: 'A' | 'B' | 'C' | null;
  score?: number | null;
  /** Link to the full candidate detail page (PDF + AI analysis + history). Omitted where there's no single application to link to. */
  viewHref?: string;
};

/** Quick-view profile modal, opened by clicking a candidate's name in the applications table, kanban board, or compare view — same profile content as the candidate detail page's Profile tab, without leaving the current screen. */
export function CandidateProfileModal({ open, onClose, name, profile, tier, score, viewHref }: Props) {
  const showMeta = tier || score !== undefined || viewHref;
  return (
    <Modal open={open} onClose={onClose} title={name} width="620px">
      {showMeta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', marginTop: '-8px' }}>
          {tier && <Badge tier={tier} size="sm" />}
          {score != null && (
            <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{formatScore(score)}</span>
          )}
          {viewHref && (
            <Link
              href={viewHref}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-primary-light)',
                textDecoration: 'none',
              }}
            >
              Full profile <ArrowUpRight size={13} />
            </Link>
          )}
        </div>
      )}
      <ProfileDetails profile={profile} />
    </Modal>
  );
}
