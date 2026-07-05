'use client';

import React from 'react';
import { SimilarSearch } from '@/components/roleHistory/SimilarSearch';
import { RoleHistoryTable } from '@/components/roleHistory/RoleHistoryTable';

export default function RoleHistoryPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1200px' }}>
      <div>
        <h1
          style={{
            margin: '0 0 6px',
            fontSize: '24px',
            fontWeight: 800,
            color: '#F1F5F9',
            letterSpacing: '-0.5px',
          }}
        >
          Role History
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
          Browse past accepted candidates and use semantic search to find similar profiles for new openings.
        </p>
      </div>

      <SimilarSearch />
      <RoleHistoryTable />
    </div>
  );
}
