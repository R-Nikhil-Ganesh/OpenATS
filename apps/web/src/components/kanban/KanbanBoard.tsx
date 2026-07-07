'use client';

import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { jobsApi, applicationsApi, type Application } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatScore, formatRelative } from '@/lib/utils';
import { differenceInDays } from 'date-fns';

type Column = {
  id: string;
  label: string;
  color: string;
  bg: string;
};

const COLUMNS: Column[] = [
  { id: 'applied', label: 'Applied', color: '#64748B', bg: 'rgba(100,116,139,0.08)' },
  { id: 'screening', label: 'Screening', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
  { id: 'interviewing', label: 'Interviewing', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  { id: 'hired', label: 'Hired', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  { id: 'rejected', label: 'Rejected', color: '#F43F5E', bg: 'rgba(244,63,94,0.08)' },
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
    const col = app.status ?? 'applied';
    if (board[col]) {
      board[col].push(app);
    }
  });
  return board;
}

export function KanbanBoard({ jobId }: Props) {
  const queryClient = useQueryClient();
  const [board, setBoard] = useState<BoardState | null>(null);

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
          const cards = board[col.id] ?? [];
          return (
            <div
              key={col.id}
              style={{
                minWidth: 230,
                width: 230,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                background: col.bg,
                borderRadius: '13px',
                border: `1px solid ${col.color}25`,
                overflow: 'hidden',
              }}
            >
              {/* Column header with colored top border */}
              <div
                style={{
                  height: 3,
                  background: col.color,
                  borderRadius: '13px 13px 0 0',
                }}
              />
              <div
                style={{
                  padding: '14px 14px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px', color: col.color }}>
                  {col.label}
                </span>
                <span
                  style={{
                    background: `${col.color}20`,
                    color: col.color,
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {cards.length}
                </span>
              </div>

              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      flex: 1,
                      padding: '0 10px 10px',
                      minHeight: 100,
                      background: snapshot.isDraggingOver ? `${col.color}08` : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
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
                              transition={{ delay: index * 0.04 }}
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: snapDrag.isDragging
                                  ? `1px solid ${col.color}60`
                                  : '1px solid rgba(255,255,255,0.07)',
                                borderRadius: '10px',
                                padding: '12px',
                                boxShadow: snapDrag.isDragging
                                  ? `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${col.color}30`
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
                                    color: '#F1F5F9',
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
                                  marginTop: '6px',
                                }}
                              >
                                <Badge tier={app.tier ?? undefined} size="sm" />
                                <span
                                  style={{
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
                                  color: '#475569',
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
