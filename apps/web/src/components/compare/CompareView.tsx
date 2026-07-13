'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Trophy, Minus, Send, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  compareApi,
  type CompareResult,
  type CompareCandidate,
  type CompareChatMessage,
} from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { tierColor, formatScore } from '@/lib/utils';

type Props = {
  applicationIds: [string, string];
};

type Side = 'a' | 'b';

function CandidateHeader({ candidate, side, isWinner }: { candidate: CompareCandidate; side: Side; isWinner: boolean }) {
  const color = tierColor(candidate.tier);
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '18px 20px',
        background: isWinner ? 'rgba(var(--color-primary-rgb),0.06)' : 'transparent',
        border: isWinner
          ? '1px solid rgba(var(--color-primary-rgb),0.25)'
          : '1px solid rgba(var(--ink-rgb),0.08)',
        borderRadius: '14px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 800,
          color,
          background: `rgba(var(--ink-rgb),0.04)`,
          border: `2px solid ${color}`,
        }}
      >
        {candidate.score !== null ? Math.round(candidate.score) : '—'}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {side === 'a' ? 'Candidate A' : 'Candidate B'}
          </span>
          {isWinner && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--color-primary-light)', fontSize: '11px', fontWeight: 700 }}>
              <Trophy size={12} /> Edge
            </span>
          )}
        </div>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {candidate.fullName}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {candidate.tier ? <Badge tier={candidate.tier} size="sm" /> : null}
          <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{formatScore(candidate.score)}</span>
        </div>
      </div>
    </div>
  );
}

function EdgePill({ edge, names }: { edge: 'a' | 'b' | 'tie'; names: { a: string; b: string } }) {
  const label = edge === 'tie' ? 'Even' : edge === 'a' ? names.a : names.b;
  const isTie = edge === 'tie';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        color: isTie ? 'var(--color-muted)' : 'var(--color-primary-light)',
        background: isTie ? 'rgba(var(--color-muted-rgb),0.12)' : 'rgba(var(--color-primary-rgb),0.12)',
        border: `1px solid ${isTie ? 'rgba(var(--color-muted-rgb),0.25)' : 'rgba(var(--color-primary-rgb),0.3)'}`,
      }}
    >
      {isTie ? <Minus size={11} /> : <Trophy size={11} />}
      {label}
    </span>
  );
}

function DimensionRow({
  dim,
  names,
}: {
  dim: CompareResult['comparison']['dimensions'][number];
  names: { a: string; b: string };
}) {
  const cell = (text: string, highlighted: boolean) => (
    <div
      style={{
        flex: 1,
        padding: '12px 14px',
        fontSize: '13px',
        lineHeight: 1.55,
        color: highlighted ? 'var(--color-text-body)' : 'var(--color-muted)',
        background: highlighted ? 'rgba(var(--color-primary-rgb),0.05)' : 'transparent',
        borderRadius: '8px',
      }}
    >
      {text}
    </div>
  );

  return (
    <div
      style={{
        padding: '14px 0',
        borderBottom: '1px solid rgba(var(--ink-rgb),0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px', padding: '0 14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{dim.name}</span>
        <EdgePill edge={dim.edge} names={names} />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {cell(dim.a_assessment, dim.edge === 'a')}
        {cell(dim.b_assessment, dim.edge === 'b')}
      </div>
    </div>
  );
}

function ChatPanel({ applicationIds, names }: { applicationIds: [string, string]; names: { a: string; b: string } }) {
  const [messages, setMessages] = useState<CompareChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const askMutation = useMutation({
    mutationFn: (question: string) => compareApi.ask(applicationIds, question, messages).then((r) => r.data),
    onSuccess: (data) => {
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }]);
    },
    onError: () => {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: '⚠️ Sorry — I couldn\'t answer that just now. Please try again.' },
      ]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, askMutation.isPending]);

  const submit = () => {
    const q = input.trim();
    if (!q || askMutation.isPending) return;
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    askMutation.mutate(q);
  };

  const suggestions = [
    `Who is stronger overall and why?`,
    `Which one has more relevant experience?`,
    `What are the biggest risks with each?`,
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(var(--ink-rgb),0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Sparkles size={16} color="var(--color-primary-light)" />
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Ask about these candidates</span>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-muted)' }}>
              Ask a follow-up and the AI will answer using both resumes and the job description.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setMessages((m) => [...m, { role: 'user', content: s }]);
                    askMutation.mutate(s);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '9px 12px',
                    fontSize: '13px',
                    color: 'var(--color-text-body)',
                    background: 'rgba(var(--ink-rgb),0.03)',
                    border: '1px solid rgba(var(--ink-rgb),0.08)',
                    borderRadius: '9px',
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              fontSize: '13px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              color: m.role === 'user' ? '#fff' : 'var(--color-text-body)',
              background:
                m.role === 'user'
                  ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))'
                  : 'rgba(var(--ink-rgb),0.04)',
              border: m.role === 'user' ? 'none' : '1px solid rgba(var(--ink-rgb),0.08)',
            }}
          >
            {m.content}
          </div>
        ))}

        {askMutation.isPending && (
          <div style={{ alignSelf: 'flex-start', padding: '10px 14px' }}>
            <Spinner size="sm" />
          </div>
        )}
      </div>

      <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(var(--ink-rgb),0.07)', display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Ask about ${names.a} vs ${names.b}…`}
          style={{
            flex: 1,
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--color-text-strong)',
            background: 'rgba(var(--ink-rgb),0.03)',
            border: '1px solid rgba(var(--ink-rgb),0.08)',
            borderRadius: '9px',
            outline: 'none',
          }}
        />
        <Button variant="primary" size="md" onClick={submit} disabled={!input.trim() || askMutation.isPending}>
          <Send size={14} />
        </Button>
      </div>
    </div>
  );
}

export function CompareView({ applicationIds }: Props) {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['compare', ...applicationIds],
    queryFn: () => compareApi.compare(applicationIds).then((r) => r.data),
    // The LLM call is expensive; don't silently re-run on window focus.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '100px' }}>
        <Spinner size="lg" />
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-muted)' }}>Weighing both candidates…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          padding: '80px',
          textAlign: 'center',
        }}
      >
        <AlertTriangle size={28} color="var(--color-warning)" />
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-muted)' }}>
          Couldn&apos;t generate the comparison. The AI service may be unavailable.
        </p>
        <Button variant="outline" size="md" onClick={() => refetch()} loading={isRefetching}>
          <RefreshCw size={14} /> Try again
        </Button>
      </div>
    );
  }

  const { candidates, comparison } = data;
  const names = { a: candidates.a.fullName, b: candidates.b.fullName };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Candidate headers */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <CandidateHeader candidate={candidates.a} side="a" isWinner={comparison.winner === 'a'} />
        <CandidateHeader candidate={candidates.b} side="b" isWinner={comparison.winner === 'b'} />
      </div>

      {/* Verdict */}
      <div
        style={{
          padding: '18px 20px',
          background: 'rgba(var(--color-primary-rgb),0.06)',
          border: '1px solid rgba(var(--color-primary-rgb),0.2)',
          borderRadius: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          {comparison.winner === 'tie' ? (
            <Minus size={16} color="var(--color-muted)" />
          ) : (
            <Trophy size={16} color="var(--color-primary-light)" />
          )}
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {comparison.winner === 'tie'
              ? 'Too close to call'
              : `Stronger fit: ${comparison.winner === 'a' ? names.a : names.b}`}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text-body)' }}>{comparison.summary}</p>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Dimension breakdown */}
        <div
          style={{
            flex: '1 1 460px',
            minWidth: 0,
            border: '1px solid rgba(var(--ink-rgb),0.08)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', padding: '12px 14px', background: 'rgba(var(--ink-rgb),0.02)', borderBottom: '1px solid rgba(var(--ink-rgb),0.07)' }}>
            <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {names.a}
            </span>
            <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {names.b}
            </span>
          </div>
          {comparison.dimensions.map((dim, i) => (
            <DimensionRow key={`${dim.name}-${i}`} dim={dim} names={names} />
          ))}
        </div>

        {/* Chat */}
        <div
          style={{
            flex: '1 1 380px',
            minWidth: 0,
            height: 540,
            border: '1px solid rgba(var(--ink-rgb),0.08)',
            borderRadius: '14px',
            overflow: 'hidden',
            background: 'rgba(var(--ink-rgb),0.02)',
          }}
        >
          <ChatPanel applicationIds={applicationIds} names={names} />
        </div>
      </div>
    </div>
  );
}
