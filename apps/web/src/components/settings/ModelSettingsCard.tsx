'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cpu, Check, AlertTriangle } from 'lucide-react';
import { settingsApi, type ModelSettings } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

type FieldKey = keyof ModelSettings;

const FIELDS: { key: FieldKey; label: string; description: string }[] = [
  {
    key: 'profile_model',
    label: 'Profile extraction',
    description: 'Converts each resume into a structured profile (name, links, skills). High volume — favor a fast model.',
  },
  {
    key: 'scoring_model',
    label: 'Resume scoring',
    description: 'Scores each uploaded resume against the job. High volume — favor a fast model.',
  },
  {
    key: 'compare_model',
    label: 'Resume compare',
    description: 'Weighs two candidates head-to-head. Low volume — a stronger model pays off.',
  },
  {
    key: 'chat_model',
    label: 'Resume chat',
    description: 'Answers follow-up questions in the compare view.',
  },
];

export function ModelSettingsCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = user?.role === 'owner';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings-models'],
    queryFn: () => settingsApi.getModels().then((r) => r.data),
  });

  const [draft, setDraft] = useState<ModelSettings | null>(null);
  const [savedAt, setSavedAt] = useState(false);

  // Sync local draft when server data first arrives (or changes).
  useEffect(() => {
    if (data?.selected) setDraft(data.selected);
  }, [data?.selected]);

  const saveMutation = useMutation({
    mutationFn: (updates: Partial<ModelSettings>) => settingsApi.updateModels(updates).then((r) => r.data),
    onSuccess: (res) => {
      queryClient.setQueryData(['settings-models'], (prev: typeof data) =>
        prev ? { ...prev, selected: res.selected } : prev
      );
      setDraft(res.selected);
      setSavedAt(true);
      setTimeout(() => setSavedAt(false), 2500);
    },
  });

  // Build the option list for a field: available models ∪ the current value.
  const optionsFor = useMemo(() => {
    const available = data?.available ?? [];
    return (current: string) => Array.from(new Set([...available, current].filter(Boolean)));
  }, [data?.available]);

  const dirty = useMemo(() => {
    if (!draft || !data?.selected) return {} as Partial<ModelSettings>;
    const changes: Partial<ModelSettings> = {};
    for (const { key } of FIELDS) {
      if (draft[key] !== data.selected[key]) changes[key] = draft[key];
    }
    return changes;
  }, [draft, data?.selected]);

  const hasChanges = Object.keys(dirty).length > 0;
  const llmUnreachable = (data?.available?.length ?? 0) === 0;

  return (
    <div
      style={{
        background: 'rgba(var(--ink-rgb),0.02)',
        border: '1px solid rgba(var(--ink-rgb),0.06)',
        borderRadius: '12px',
        padding: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <Cpu size={18} color="var(--color-primary-light)" />
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-text-strong)' }}>
          AI Models
        </h2>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--color-muted)' }}>
        Choose which model backs each AI feature. Changes apply to new runs immediately.
      </p>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
          <Spinner size="md" />
        </div>
      ) : isError || !draft ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-muted)', fontSize: '13px' }}>
          <AlertTriangle size={15} color="var(--color-warning)" />
          Couldn&apos;t load model settings.
        </div>
      ) : (
        <>
          {llmUnreachable && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                marginBottom: '16px',
                background: 'rgba(var(--color-warning-rgb),0.08)',
                border: '1px solid rgba(var(--color-warning-rgb),0.25)',
                borderRadius: '9px',
                fontSize: '12.5px',
                color: 'var(--color-warning)',
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              Couldn&apos;t reach the LLM server to list models — you can still type a model name below.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {FIELDS.map(({ key, label, description }) => {
              const value = draft[key];
              const options = optionsFor(value);
              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {label}
                  </label>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)' }}>{description}</p>
                  {llmUnreachable ? (
                    <input
                      value={value}
                      disabled={!canEdit}
                      onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))}
                      style={inputStyle(canEdit)}
                    />
                  ) : (
                    <select
                      value={value}
                      disabled={!canEdit}
                      onChange={(e) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d))}
                      style={inputStyle(canEdit)}
                    >
                      {options.map((opt) => (
                        <option
                          key={opt}
                          value={opt}
                          style={{
                            background: 'var(--color-surface)',
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '22px' }}>
            <Button
              variant="primary"
              size="md"
              disabled={!canEdit || !hasChanges}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate(dirty)}
            >
              Save changes
            </Button>
            {savedAt && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--color-success)' }}>
                <Check size={14} /> Saved
              </span>
            )}
            {!canEdit && (
              <span style={{ fontSize: '12.5px', color: 'var(--color-muted)' }}>
                Only an owner can change these.
              </span>
            )}
            {saveMutation.isError && (
              <span style={{ fontSize: '12.5px', color: 'var(--color-danger)' }}>
                Save failed — please try again.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function inputStyle(enabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    maxWidth: 360,
    boxSizing: 'border-box',
    padding: '9px 12px',
    fontSize: '13px',
    color: 'var(--color-text-primary)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '9px',
    outline: 'none',
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.7,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgb(148,163,184)' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: 32,
  };
}
