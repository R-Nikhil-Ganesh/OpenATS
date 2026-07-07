'use client';

import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { jobsApi, applicationsApi, type Application } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatScore, formatRelative } from '@/lib/utils';
import { differenceInDays } from 'date-fns';

type Column = {
  id: string;
  label: string;
  color: string;
  /** Bare `--color-x-rgb` reference for custom-alpha rgba() at the call site. */
  rgb: string;
  bg: string;
};

const COLUMNS: Column[] = [
  { id: 'reviewable', label: 'Reviewable', color: 'var(--color-muted)', rgb: 'var(--color-muted-rgb)', bg: 'rgba(var(--color-muted-rgb),0.08)' },
  { id: 'screening', label: 'Screening', color: 'var(--color-primary)', rgb: 'var(--color-primary-rgb)', bg: 'rgba(var(--color-primary-rgb),0.08)' },
  { id: 'interviewing', label: 'Interviewing', color: 'var(--color-warning)', rgb: 'var(--color-warning-rgb)', bg: 'rgba(var(--color-warning-rgb),0.08)' },
  { id: 'hired', label: 'Hired', color: 'var(--color-success)', rgb: 'var(--color-success-rgb)', bg: 'rgba(var(--color-success-rgb),0.08)' },
  { id: 'rejected', label: 'Rejected', color: 'var(--color-danger)', rgb: 'var(--color-danger-rgb)', bg: 'rgba(var(--color-danger-rgb),0.08)' },
];

type Props = {
  jobId: string;
};

type BoardState = Record<string, Application[]>;

function buildBoard(applications: Application[]): BoardState {
  const board: BoardState = {};
  COLUMNS.forEach((col) => {
    board[col.id] = [];
  });
  applications.forEach((app) => {
    const col = app.status ?? 'reviewable';
    if (board[col]) {
      board[col].push(app);
    }
  });
  return board;
}

export function KanbanBoard({ jobId }: Props) {
  const queryClient = useQueryClient();
  const [board, setBoard] = useState<BoardState | null>(null);
  const [search, setSearch] = useState<Record<string, string>>({});

  const { data: apps, isLoading } = useQuery({
    queryKey: ['job-applications-all', jobId],
    queryFn: () => jobsApi.getApplications(jobId).then((r) => r.data.applications),
  });

  React.useEffect(() => {
    if (apps) {
      setBoard(buildBoard(apps));
    }
  }, [apps]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      applicationsApi.updateStatus(id, { status }),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['job-applications-all', jobId] });
    },
  });

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination || !board) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const srcCol = [...board[source.droppableId]];
    const dstCol = source.droppableId === destination.droppableId ? srcCol : [...board[destination.droppableId]];

    const [moved] = srcCol.splice(source.index, 1);
    dstCol.splice(destination.index, 0, moved);

    const newBoard: BoardState = {
      ...board,
      [source.droppableId]: srcCol,
      [destination.droppableId]: dstCol,
    };

    setBoard(newBoard);

    updateStatusMutation.mutate({
      id: draggableId,
      status: destination.droppableId,
    });
  };

  if (isLoading || !board) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const filteredCards = (colId: string): Application[] => {
    const cards = board[colId] ?? [];
    const q = search[colId]?.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((app) => {
      const name = app.candidate?.full_name?.toLowerCase() ?? '';
      const email = app.candidate?.email?.toLowerCase() ?? '';
      return name.includes(q) || email.includes(q);
    });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div
        style={{
          display: 'flex',
          gap: '14px',
          overflowX: 'auto',
          paddingBottom: '16px',
          minHeight: '65vh',
        }}
      >
        {COLUMNS.map((col) => {
          const allCards = board[col.id] ?? [];
          const cards = filteredCards(col.id);
          return (
            <div
              key={col.id}
              style={{
                minWidth: 260,
                width: 260,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                background: col.bg,
                borderRadius: '13px',
                border: `1px solid rgba(${col.rgb},0.15)`,
                overflow: 'hidden',
                maxHeight: '75vh',
              }}
            >
              {/* Column header with colored top border */}
              <div
                style={{
                  height: 3,
                  background: col.color,
                  borderRadius: '13px 13px 0 0',
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  padding: '14px 14px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px', color: col.color }}>
                  {col.label}
                </span>
                <span
                  style={{
                    background: `rgba(${col.rgb},0.13)`,
                    color: col.color,
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {search[col.id]?.trim() ? `${cards.length}/${allCards.length}` : allCards.length}
                </span>
              </div>

              {allCards.length > 4 && (
                <div style={{ padding: '0 10px 8px', flexShrink: 0 }}>
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={12}
                      color="var(--color-muted)"
                      style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      value={search[col.id] ?? ''}
                      onChange={(e) => setSearch((prev) => ({ ...prev, [col.id]: e.target.value }))}
                      placeholder="Search…"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '6px 8px 6px 26px',
                        fontSize: '12px',
                        color: 'var(--color-text-strong)',
                        background: 'rgba(var(--ink-rgb),0.04)',
                        border: '1px solid rgba(var(--ink-rgb),0.08)',
                        borderRadius: '7px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              )}

              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      flex: 1,
                      padding: '0 10px 10px',
                      minHeight: 100,
                      overflowY: 'auto',
                      background: snapshot.isDraggingOver ? `rgba(${col.rgb},0.03)` : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {cards.length === 0 && allCards.length > 0 && (
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0' }}>
                        No matches
                      </p>
                    )}
                    {cards.map((app, index) => (
                      <Draggable key={app.id} draggableId={app.id} index={index}>
                        {(drag, snapDrag) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            style={{
                              ...drag.draggableProps.style,
                              marginBottom: 8,
                            }}
                          >
                            <motion.div
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(index, 8) * 0.03 }}
                              style={{
                                background: 'rgba(var(--ink-rgb),0.04)',
                                border: snapDrag.isDragging
                                  ? `1px solid rgba(${col.rgb},0.38)`
                                  : '1px solid rgba(var(--ink-rgb),0.07)',
                                borderRadius: '10px',
                                padding: '12px',
                                boxShadow: snapDrag.isDragging
                                  ? `0 8px 24px rgba(var(--shadow-rgb),0.112), 0 0 0 1px rgba(${col.rgb},0.19)`
                                  : 'none',
                                cursor: 'grab',
                              }}
                            >
                              <Link
                                href={`/candidates/${app.id}`}
                                style={{ textDecoration: 'none', display: 'block' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p
                                  style={{
                                    margin: '0 0 4px',
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    color: 'var(--color-text-primary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {app.candidate?.full_name ?? 'Unknown'}
                                </p>
                              </Link>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '6px',
                                  marginTop: '6px',
                                  minWidth: 0,
                                }}
                              >
                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                  <Badge tier={app.tier ?? undefined} size="sm" />
                                </div>
                                <span
                                  style={{
                                    flexShrink: 0,
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: col.color,
                                  }}
                                >
                                  {formatScore(app.score)}
                                </span>
                              </div>
                              <p
                                style={{
                                  margin: '6px 0 0',
                                  fontSize: '11px',
                                  color: 'var(--color-text-muted)',
                                }}
                              >
                                {differenceInDays(new Date(), new Date(app.created_at))} days in stage
                              </p>
                            </motion.div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
