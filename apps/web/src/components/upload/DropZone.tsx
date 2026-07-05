'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
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
  const { statusMap } = useSSE();

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
      fd.append('resume', item.file);

      try {
        await apiClient.post(`/jobs/${jobId}/resumes`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, uploadStatus: 'uploaded' } : f))
        );
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
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      pending: { label: 'Queued', color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
      uploading: { label: 'Uploading', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
      uploaded: { label: 'Uploaded', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
      queued: { label: 'Queued', color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
      extracting: { label: 'Extracting', color: '#818CF8', bg: 'rgba(129,140,248,0.12)' },
      scoring: { label: 'Scoring', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
      completed: { label: 'Done', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
      failed: { label: 'Failed', color: '#F43F5E', bg: 'rgba(244,63,94,0.12)' },
      error: { label: 'Error', color: '#F43F5E', bg: 'rgba(244,63,94,0.12)' },
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
          border: `1px solid ${cfg.color}33`,
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
            ? '2px dashed #6366F1'
            : '2px dashed rgba(255,255,255,0.1)',
          borderRadius: '14px',
          padding: '48px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragActive ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.2s ease',
          boxShadow: isDragActive ? '0 0 0 4px rgba(99,102,241,0.15)' : 'none',
        }}
      >
        <input {...getInputProps()} />
        <Upload
          size={36}
          color={isDragActive ? '#6366F1' : '#334155'}
          style={{ marginBottom: '12px' }}
        />
        <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: '#E2E8F0' }}>
          {isDragActive ? 'Drop PDF resumes here' : 'Drop PDF resumes here or click to browse'}
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
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
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
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
                      i < files.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <FileText size={16} color="#6366F1" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#E2E8F0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.file.name}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>
                      {formatBytes(item.file.size)}
                    </p>
                  </div>

                  {statusPill(status)}

                  {status === 'uploading' && (
                    <Loader size={14} color="#6366F1" style={{ animation: 'spin 1s linear infinite' }} />
                  )}
                  {status === 'completed' && <CheckCircle size={14} color="#10B981" />}
                  {(status === 'error' || status === 'failed') && (
                    <span title={item.errorMsg} style={{ display: 'flex' }}>
                      <AlertCircle size={14} color="#F43F5E" />
                    </span>
                  )}

                  {item.uploadStatus === 'pending' && (
                    <button
                      onClick={() => removeFile(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
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
    </div>
  );
}
