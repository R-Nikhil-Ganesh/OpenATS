'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { jobsApi, roleHistoryApi } from '@/lib/api';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { motion, AnimatePresence } from 'framer-motion';
import { formatScore } from '@/lib/utils';

export function SimilarSearch() {
  const [selectedJobId, setSelectedJobId] = useState('');
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: jobsData } = useQuery({
    queryKey: ['jobs-list-all'],
    queryFn: () => jobsApi.list({ limit: 100 }).then((r) => r.data),
  });

  const { data: results, isFetching } = useQuery({
    queryKey: ['similar-candidates', selectedJobId],
    queryFn: () => roleHistoryApi.findSimilar(selectedJobId).then((r) => r.data),
    enabled: searchTriggered && !!selectedJobId,
  });

  const jobOptions = [
    { value: '', label: 'Select a job...' },
    ...(jobsData?.jobs ?? []).map((j) => ({ value: j.id, label: j.title })),
  ];

  const handleFind = () => {
    if (selectedJobId) {
      setSearchTriggered(true);
    }
  };

  return (
    <Card padding="24px">
      <div style={{ marginBottom: '18px' }}>
        <h3
          style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#F1F5F9' }}
        >
          Semantic Similarity Search
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
          Find past candidates who closely match a current job opening
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <Select
            label="Select Job"
            options={jobOptions}
            value={selectedJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value);
              setSearchTriggered(false);
            }}
          />
        </div>
        <Button
          variant="primary"
          size="md"
          loading={isFetching}
          onClick={handleFind}
          disabled={!selectedJobId}
        >
          <Search size={14} />
          Find Similar
        </Button>
      </div>

      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {results.results.length === 0 && (
              <p style={{ color: '#64748B', textAlign: 'center', padding: '20px' }}>
                No similar candidates found
              </p>
            )}
            {results.results.map((candidate, i) => (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px',
                }}
              >
                {/* Rank */}
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(99,102,241,0.15)',
                    color: '#818CF8',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>

                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 600, color: '#F1F5F9' }}>
                    {candidate.candidate_name}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                    {candidate.role} · {candidate.department}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <Badge tier={candidate.tier} size="sm" />
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Score: {formatScore(candidate.score)}
                  </span>
                </div>

                {/* Similarity bar */}
                <div style={{ width: 80 }}>
                  <div
                    style={{
                      height: 5,
                      background: 'rgba(255,255,255,0.07)',
                      borderRadius: 10,
                      overflow: 'hidden',
                      marginBottom: 3,
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${candidate.similarity_score * 100}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.05 }}
                      style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #6366F1, #818CF8)',
                        borderRadius: 10,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    {Math.round(candidate.similarity_score * 100)}% match
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
