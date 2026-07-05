import type { Metadata } from 'next';
import { CreateJobForm } from '@/components/jobs/CreateJobForm';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'New Job — OpenATS',
  description: 'Create a new job requisition and start receiving AI-ranked applicants.',
};

export default function NewJobPage() {
  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
        <Link href="/jobs" style={{ color: '#64748B', textDecoration: 'none' }}>
          Jobs
        </Link>
        <ChevronRight size={13} color="#475569" />
        <span style={{ color: '#E2E8F0', fontWeight: 500 }}>New Job</span>
      </nav>

      <div>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.5px' }}>
          Create Job Requisition
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>
          Fill in the details below. The JD will be used by the AI to rank incoming resumes.
        </p>
      </div>

      <CreateJobForm />
    </div>
  );
}
