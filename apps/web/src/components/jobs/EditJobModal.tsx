'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi, type Job } from '@/lib/api';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

const employmentTypeOptions = [
  { value: 'full_time', label: 'Full-Time' },
  { value: 'part_time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
];

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

type FormData = {
  title: string;
  department: string;
  location: string;
  employment_type: string;
  status: string;
  raw_jd: string;
  experience_years_min: string;
  experience_years_max: string;
};

type Props = {
  job: Job;
  open: boolean;
  onClose: () => void;
};

function toFormData(job: Job): FormData {
  return {
    title: job.title ?? '',
    department: job.department ?? '',
    location: job.location ?? '',
    employment_type: job.employment_type ?? 'full_time',
    status: job.status ?? 'draft',
    raw_jd: job.raw_jd ?? '',
    experience_years_min: String(job.experience_years_min ?? 0),
    experience_years_max: String(job.experience_years_max ?? 0),
  };
}

export function EditJobModal({ job, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormData>(() => toFormData(job));
  const [errors, setErrors] = useState<Partial<FormData>>({});

  React.useEffect(() => {
    if (open) {
      setForm(toFormData(job));
      setErrors({});
    }
  }, [open, job]);

  const mutation = useMutation({
    mutationFn: () =>
      jobsApi.update(job.id, {
        title: form.title,
        department: form.department,
        location: form.location,
        employment_type: form.employment_type as Job['employment_type'],
        status: form.status as Job['status'],
        raw_jd: form.raw_jd,
        experience_years_min: parseInt(form.experience_years_min, 10),
        experience_years_max: parseInt(form.experience_years_max, 10),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      onClose();
    },
  });

  const validate = (): boolean => {
    const errs: Partial<FormData> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.department.trim()) errs.department = 'Department is required';
    if (!form.raw_jd.trim()) errs.raw_jd = 'Job description is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) mutation.mutate();
  };

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Edit Job Requisition" width="640px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input label="Job Title" value={form.title} onChange={set('title')} error={errors.title} />
          <Input label="Department" value={form.department} onChange={set('department')} error={errors.department} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input label="Location" value={form.location} onChange={set('location')} />
          <Select
            label="Employment Type"
            value={form.employment_type}
            onChange={set('employment_type')}
            options={employmentTypeOptions}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Select label="Status" value={form.status} onChange={set('status')} options={statusOptions} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input
              label="Min Exp (yrs)"
              type="number"
              min="0"
              value={form.experience_years_min}
              onChange={set('experience_years_min')}
            />
            <Input
              label="Max Exp (yrs)"
              type="number"
              min="0"
              value={form.experience_years_max}
              onChange={set('experience_years_max')}
            />
          </div>
        </div>

        <Textarea
          label="Job Description"
          value={form.raw_jd}
          onChange={set('raw_jd')}
          error={errors.raw_jd}
          rows={8}
        />

        {mutation.isError && (
          <p style={{ margin: 0, color: '#F43F5E', fontSize: '13px' }}>
            Failed to save changes. Please try again.
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={mutation.isPending}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
