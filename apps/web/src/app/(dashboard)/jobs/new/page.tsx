import type { Metadata } from 'next';
import { CreateJobForm } from '@/components/jobs/CreateJobForm';
import { Breadcrumb } from '@/components/layout/Breadcrumb';

export const metadata: Metadata = {
  title: 'New Job — OpenATS',
  description: 'Create a new job requisition and start receiving AI-ranked applicants.',
};

export default function NewJobPage() {
  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Breadcrumb items={[{ label: 'Jobs', href: '/jobs' }, { label: 'New Job' }]} />

      <div>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.5px' }}>
          Create Job Requisition
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-muted)' }}>
          Fill in the details below. The JD will be used by the AI to rank incoming resumes.
        </p>
      </div>

      <CreateJobForm />
    </div>
  );
}
