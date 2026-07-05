'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '@/lib/api';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const employmentTypeOptions = [
  { value: 'full-time', label: 'Full-Time' },
  { value: 'part-time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

type FormData = {
  title: string;
  department: string;
  location: string;
  employment_type: string;
  raw_jd: string;
  experience_years_min: string;
  experience_years_max: string;
};

export function CreateJobForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormData>({
    title: '',
    department: '',
    location: '',
    employment_type: 'full-time',
    raw_jd: '',
    experience_years_min: '0',
    experience_years_max: '5',
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});

  const mutation = useMutation({
    mutationFn: () =>
      jobsApi.create({
        title: form.title,
        department: form.department,
        location: form.location,
        employment_type: form.employment_type,
        raw_jd: form.raw_jd,
        experience_years_min: parseInt(form.experience_years_min, 10),
        experience_years_max: parseInt(form.experience_years_max, 10),
        status: 'active',
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      router.push(`/jobs/${res.data.id}`);
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
    <Card padding="32px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input
            label="Job Title"
            placeholder="e.g. Senior Backend Engineer"
            value={form.title}
            onChange={set('title')}
            error={errors.title}
          />
          <Input
            label="Department"
            placeholder="e.g. Engineering"
            value={form.department}
            onChange={set('department')}
            error={errors.department}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input
            label="Location"
            placeholder="e.g. Remote / San Francisco"
            value={form.location}
            onChange={set('location')}
          />
          <Select
            label="Employment Type"
            value={form.employment_type}
            onChange={set('employment_type')}
            options={employmentTypeOptions}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input
            label="Min Experience (years)"
            type="number"
            min="0"
            value={form.experience_years_min}
            onChange={set('experience_years_min')}
          />
          <Input
            label="Max Experience (years)"
            type="number"
            min="0"
            value={form.experience_years_max}
            onChange={set('experience_years_max')}
          />
        </div>

        <Textarea
          label="Job Description"
          placeholder="Paste the full job description here..."
          value={form.raw_jd}
          onChange={set('raw_jd')}
          error={errors.raw_jd}
          rows={10}
        />

        {mutation.isError && (
          <p style={{ margin: 0, color: '#F43F5E', fontSize: '13px' }}>
            Failed to create job. Please try again.
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="submit" variant="primary" size="lg" loading={mutation.isPending}>
            Create Job Requisition
          </Button>
        </div>
      </form>
    </Card>
  );
}
