'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSSE } from '@/hooks/useSSE';
import apiClient from '@/lib/api';

type FileItem = {
  id: string;
  file: File;
  applicationId?: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'error';
  errorMsg?: string;
};

type DropZoneProps = {
  jobId: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DropZone({ jobId }: DropZoneProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const { statusMap } = useSSE();
  const queryClient = useQueryClient();

  const onDrop = useCallback((accepted: File[]) => {
    const newItems = accepted.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      uploadStatus: 'pending' as const,
    }));
    setFiles((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 20,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleUpload = async () => {
    const pending = files.filter((f) => f.uploadStatus === 'pending');
    if (pending.length === 0) return;

    setUploading(true);

    for (const item of pending) {
      setFiles((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, uploadStatus: 'uploading' } : f))
      );

      const fd = new FormData();
      fd.append('resumes', item.file);

      try {
        const res = await apiClient.post<{ results: { applicationId: string; status: string }[] }>(
          `/jobs/${jobId}/resumes`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        const applicationId = res.data.results[0]?.applicationId || undefined;
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, uploadStatus: 'uploaded', applicationId } : f
          )
        );
        setUploadedCount((c) => c + 1);
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : 'Upload failed';
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, uploadStatus: 'error', errorMsg } : f
          )
        );
      }
    }

    setUploading(false);
    queryClient.invalidateQueries({ queryKey: ['job-stats', jobId] });
    queryClient.invalidateQueries({ queryKey: ['job-applications-all', jobId] });
    queryClient.invalidateQueries({ queryKey: ['job-applications', jobId] });
    queryClient.invalidateQueries({ queryKey: ['job-applications-counts', jobId] });
  };

  const processingStatus = (item: FileItem): string => {
    if (item.uploadStatus === 'pending') return 'pending';
    if (item.uploadStatus === 'uploading') return 'uploading';
    if (item.uploadStatus === 'error') return 'error';
    if (item.applicationId && statusMap[item.applicationId]) {
      return statusMap[item.applicationId].status;
    }
    return 'uploaded';
  };

  const statusPill = (status: string) => {
    const configs: Record<string, { label: string; color: string; rgb: string; bg: string }> = {
      pending: { label: 'Queued', color: 'var(--color-muted)', rgb: 'var(--color-muted-rgb)', bg: 'rgba(var(--color-muted-rgb),0.12)' },
      uploading: { label: 'Uploading', color: 'var(--color-primary)', rgb: 'var(--color-primary-rgb)', bg: 'rgba(var(--color-primary-rgb),0.12)' },
      uploaded: { label: 'Uploaded', color: 'var(--color-primary)', rgb: 'var(--color-primary-rgb)', bg: 'rgba(var(--color-primary-rgb),0.12)' },
      queued: { label: 'Queued', color: 'var(--color-muted)', rgb: 'var(--color-muted-rgb)', bg: 'rgba(var(--color-muted-rgb),0.12)' },
      extracting: { label: 'Extracting', color: 'var(--color-primary-light)', rgb: 'var(--color-primary-light-rgb)', bg: 'rgba(var(--color-primary-light-rgb),0.12)' },
      scoring: { label: 'Scoring', color: 'var(--color-warning)', rgb: 'var(--color-warning-rgb)', bg: 'rgba(var(--color-warning-rgb),0.12)' },
      completed: { label: 'Done', color: 'var(--color-success)', rgb: 'var(--color-success-rgb)', bg: 'rgba(var(--color-success-rgb),0.12)' },
      failed: { label: 'Failed', color: 'var(--color-danger)', rgb: 'var(--color-danger-rgb)', bg: 'rgba(var(--color-danger-rgb),0.12)' },
      error: { label: 'Error', color: 'var(--color-danger)', rgb: 'var(--color-danger-rgb)', bg: 'rgba(var(--color-danger-rgb),0.12)' },
    };

    const cfg = configs[status] ?? configs.pending;

    return (
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '20px',
          color: cfg.color,
          background: cfg.bg,
          border: `1px solid rgba(${cfg.rgb},0.2)`,
        }}
      >
        {cfg.label}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        style={{
          border: isDragActive
            ? '2px dashed var(--color-primary)'
            : '2px dashed rgba(var(--ink-rgb),0.1)',
          borderRadius: '14px',
          padding: '48px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragActive ? 'rgba(var(--color-primary-rgb),0.05)' : 'rgba(var(--ink-rgb),0.02)',
          transition: 'all 0.2s ease',
          boxShadow: isDragActive ? '0 0 0 4px rgba(var(--color-primary-rgb),0.15)' : 'none',
        }}
      >
        <input {...getInputProps()} />
        <Upload
          size={36}
          color={isDragActive ? 'var(--color-primary)' : 'var(--color-text-disabled)'}
          style={{ marginBottom: '12px' }}
        />
        <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-strong)' }}>
          {isDragActive ? 'Drop PDF resumes here' : 'Drop PDF resumes here or click to browse'}
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-muted)' }}>
          PDF only · Max 20 files per batch
        </p>
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'rgba(var(--ink-rgb),0.02)',
              border: '1px solid rgba(var(--ink-rgb),0.06)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {files.map((item, i) => {
              const status = processingStatus(item);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderBottom:
                      i < files.length - 1 ? '1px solid rgba(var(--ink-rgb),0.05)' : 'none',
                  }}
                >
                  <FileText size={16} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--color-text-strong)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.file.name}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-muted)' }}>
                      {formatBytes(item.file.size)}
                    </p>
                  </div>

                  {statusPill(status)}

                  {status === 'uploading' && (
                    <Loader size={14} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                  )}
                  {status === 'completed' && <CheckCircle size={14} color="var(--color-success)" />}
                  {(status === 'error' || status === 'failed') && (
                    <span title={item.errorMsg} style={{ display: 'flex' }}>
                      <AlertCircle size={14} color="var(--color-danger)" />
                    </span>
                  )}

                  {item.uploadStatus === 'pending' && (
                    <button
                      onClick={() => removeFile(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-muted)',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {files.some((f) => f.uploadStatus === 'pending') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="primary"
            size="md"
            loading={uploading}
            onClick={handleUpload}
          >
            <Upload size={14} />
            Upload {files.filter((f) => f.uploadStatus === 'pending').length} Resume(s)
          </Button>
        </div>
      )}

      {!uploading && uploadedCount > 0 && files.every((f) => f.uploadStatus !== 'pending' && f.uploadStatus !== 'uploading') && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'rgba(var(--color-success-rgb),0.06)',
            border: '1px solid rgba(var(--color-success-rgb),0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={16} color="var(--color-success)" />
            <span style={{ fontSize: '13px', color: 'var(--color-text-strong)' }}>
              {uploadedCount} resume{uploadedCount === 1 ? '' : 's'} uploaded — processing status updates live below.
            </span>
          </div>
          <Link href={`/jobs/${jobId}/board`} style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="sm">
              <LayoutGrid size={13} />
              View Board
            </Button>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
