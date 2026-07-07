'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { applicationsApi, type StatusHistoryEntry } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatScore, tierColor, formatDate } from '@/lib/utils';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

type Tab = 'analysis' | 'text' | 'history';

type Props = {
  applicationId: string;
};

// Animated score ring
function ScoreRing({ score, color }: { score: number; color: string }) {
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = pct * circ;

  return (
    <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
      <svg width={88} height={88} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={44}
          cy={44}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={6}
        />
        <motion.circle
          cx={44}
          cy={44}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: 800,
          color,
        }}
      >
        {Math.round(score)}
      </div>
    </div>
  );
}

function AnalysisTab({ app }: { app: NonNullable<ReturnType<typeof useQuery>['data']> }) {
  const analysis = (app as { ai_analysis?: { matched_skills?: { skill: string; confidence: number }[]; missing_requirements?: string[]; strengths?: string[]; weaknesses?: string[]; recommendation?: string } }).ai_analysis;
  const [strengthsOpen, setStrengthsOpen] = useState(true);
  const [weaknessOpen, setWeaknessOpen] = useState(false);

  if (!analysis) {
    return (
      <div style={{ color: '#64748B', textAlign: 'center', padding: '40px' }}>
        No AI analysis available
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Matched Skills */}
      {analysis.matched_skills && analysis.matched_skills.length > 0 && (
        <section>
          <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Matched Skills
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {analysis.matched_skills.map((s) => (
              <div key={s.skill} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ minWidth: 120, fontSize: '13px', color: '#E2E8F0', fontWeight: 500 }}>
                  {s.skill}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 5,
                    background: 'rgba(255,255,255,0.07)',
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${s.confidence * 100}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #6366F1, #818CF8)',
                      borderRadius: 10,
                    }}
                  />
                </div>
                <span style={{ fontSize: '12px', color: '#64748B', minWidth: 36, textAlign: 'right' }}>
                  {Math.round(s.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Missing Requirements */}
      {analysis.missing_requirements && analysis.missing_requirements.length > 0 && (
        <section>
          <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Missing Requirements
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {analysis.missing_requirements.map((req) => (
              <div
                key={req}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'rgba(244,63,94,0.06)',
                  border: '1px solid rgba(244,63,94,0.15)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#FDA4AF',
                }}
              >
                <XCircle size={13} color="#F43F5E" style={{ flexShrink: 0 }} />
                {req}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Strengths Accordion */}
      {analysis.strengths && analysis.strengths.length > 0 && (
        <section>
          <button
            onClick={() => setStrengthsOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.15)',
              borderRadius: '9px',
              padding: '10px 14px',
              color: '#10B981',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <span>Strengths ({analysis.strengths.length})</span>
            {strengthsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <AnimatePresence>
            {strengthsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {analysis.strengths.map((s) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '13px', color: '#CBD5E1' }}>
                      <CheckCircle size={13} color="#10B981" style={{ flexShrink: 0, marginTop: 1 }} />
                      {s}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Weaknesses Accordion */}
      {analysis.weaknesses && analysis.weaknesses.length > 0 && (
        <section>
          <button
            onClick={() => setWeaknessOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.15)',
              borderRadius: '9px',
              padding: '10px 14px',
              color: '#F59E0B',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <span>Areas to Improve ({analysis.weaknesses.length})</span>
            {weaknessOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <AnimatePresence>
            {weaknessOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {analysis.weaknesses.map((w) => (
                    <div key={w} style={{ fontSize: '13px', color: '#CBD5E1' }}>• {w}</div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Recommendation */}
      {analysis.recommendation && (
        <section
          style={{
            padding: '14px',
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '10px',
          }}
        >
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            AI Recommendation
          </h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
            {analysis.recommendation}
          </p>
        </section>
      )}
    </div>
  );
}

function HistoryTab({ entries }: { entries: StatusHistoryEntry[] }) {
  if (!entries.length) {
    return <p style={{ color: '#64748B', textAlign: 'center', padding: '32px' }}>No history yet</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {entries.map((entry, i) => (
        <div
          key={entry.id}
          style={{
            display: 'flex',
            gap: '12px',
            paddingBottom: i < entries.length - 1 ? '16px' : '0',
            position: 'relative',
          }}
        >
          {i < entries.length - 1 && (
            <div
              style={{
                position: 'absolute',
                left: '7px',
                top: '16px',
                bottom: 0,
                width: '1px',
                background: 'rgba(255,255,255,0.07)',
              }}
            />
          )}
          <div
            style={{
              width: 15,
              height: 15,
              borderRadius: '50%',
              background: '#6366F1',
              border: '2px solid #0A0B0D',
              flexShrink: 0,
              marginTop: '2px',
            }}
          />
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#E2E8F0' }}>
              <strong>{entry.from_status}</strong>
              {' → '}
              <strong>{entry.to_status}</strong>
            </p>
            <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#64748B' }}>
              {entry.changed_by} · {formatDate(entry.changed_at)}
            </p>
            {entry.note && (
              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                {entry.note}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CandidateSplitScreen({ applicationId }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('analysis');
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState(1);

  const { data: app, isLoading } = useQuery({
    queryKey: ['application', applicationId],
    queryFn: () => applicationsApi.get(applicationId).then((r) => r.data),
  });

  const { data: historyData } = useQuery({
    queryKey: ['application-history', applicationId],
    queryFn: () => applicationsApi.getHistory(applicationId).then((r) => r.data),
    enabled: tab === 'history',
  });

  const advanceMutation = useMutation({
    mutationFn: () => applicationsApi.updateStatus(applicationId, { status: 'screening' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application', applicationId] }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => applicationsApi.updateStatus(applicationId, { status: 'rejected' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application', applicationId] }),
  });

  const reprocessMutation = useMutation({
    mutationFn: () => applicationsApi.reprocess(applicationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application', applicationId] }),
  });

  if (isLoading || !app) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const scoreColor = tierColor(app.tier);
  const candidate = app.candidate;
  const resumeUrl = candidate?.resume_url 
    ? `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/applications/${applicationId}/resume` 
    : undefined;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'analysis', label: 'AI Analysis' },
    { id: 'text', label: 'Extracted Text' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 180px)',
        gap: '0',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {/* LEFT: PDF Viewer */}
      <div
        style={{
          width: '40%',
          minWidth: '40%',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          background: '#0D0E12',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>Resume Preview</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4 }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {pageNumber} / {numPages}
            </span>
            <button
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '16px',
          }}
        >
          {resumeUrl ? (
            <Document
              file={{
                url: resumeUrl,
                httpHeaders: { Authorization: `Bearer ${getAccessToken()}` }
              } as any}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
                  <Spinner size="md" />
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                width={380}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#334155',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              No resume file available
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Analysis panel */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <ScoreRing score={app.score ?? 0} color={scoreColor} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#F1F5F9' }}>
                {candidate?.full_name ?? 'Unknown'}
              </h2>
              <Badge tier={app.tier ?? undefined} />
              <Badge status={app.status} />
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
              {candidate?.email}
              {candidate?.phone && ` · ${candidate.phone}`}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569' }}>
              Score: {formatScore(app.score)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            padding: '0 24px',
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid #6366F1' : '2px solid transparent',
                color: tab === t.id ? '#818CF8' : '#64748B',
                fontWeight: tab === t.id ? 600 : 400,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {tab === 'analysis' && <AnalysisTab app={app} />}
              {tab === 'text' && (
                <pre
                  style={{
                    margin: 0,
                    padding: '16px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#94A3B8',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.7,
                    fontFamily: "'Fira Code', monospace",
                  }}
                >
                  {app.ai_analysis?.extracted_text ?? 'No extracted text available'}
                </pre>
              )}
              {tab === 'history' && (
                <HistoryTab entries={historyData?.history ?? []} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action bar */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            gap: '10px',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <Button
            variant="primary"
            size="md"
            loading={advanceMutation.isPending}
            onClick={() => advanceMutation.mutate()}
            disabled={app.status === 'hired' || app.status === 'rejected'}
          >
            <CheckCircle size={14} />
            Advance to Screening
          </Button>
          <Button
            variant="danger"
            size="md"
            loading={rejectMutation.isPending}
            onClick={() => rejectMutation.mutate()}
            disabled={app.status === 'rejected'}
          >
            <XCircle size={14} />
            Reject
          </Button>
          <Button
            variant="ghost"
            size="md"
            loading={reprocessMutation.isPending}
            onClick={() => reprocessMutation.mutate()}
            style={{ marginLeft: 'auto' }}
          >
            <RefreshCw size={14} />
            Reprocess
          </Button>
        </div>
      </div>
    </div>
  );
}
