INSERT INTO job_requisitions (
    tenant_id, 
    title, 
    department, 
    location, 
    employment_type, 
    status, 
    raw_jd, 
    experience_years_min, 
    experience_years_max, 
    created_by
) VALUES 
(
    '78398a36-b26e-432a-8ca1-330ecda2e016',
    'Senior Frontend Engineer',
    'Engineering',
    'San Francisco, CA (Hybrid)',
    'full_time',
    'active',
    'We are looking for a Senior Frontend Engineer to build robust React applications. You must have deep expertise in React, TypeScript, Next.js, and modern CSS strategies. Strong understanding of web performance and accessibility is a must.',
    5,
    8,
    '4667a67b-bb8e-42ad-b137-0be342f1b548'
),
(
    '78398a36-b26e-432a-8ca1-330ecda2e016',
    'Product Marketing Manager',
    'Marketing',
    'Remote (US)',
    'full_time',
    'active',
    'Join our marketing team to drive product-led growth. You will be responsible for creating compelling messaging, conducting competitor analysis, and orchestrating product launches. Must have B2B SaaS experience.',
    3,
    6,
    '4667a67b-bb8e-42ad-b137-0be342f1b548'
),
(
    '78398a36-b26e-432a-8ca1-330ecda2e016',
    'Machine Learning Engineer',
    'AI & Data',
    'New York, NY',
    'full_time',
    'active',
    'We need an ML Engineer to deploy, optimize, and maintain large language models (LLMs) in production. Experience with PyTorch, CUDA, Triton, and model quantization (AWQ/GPTQ) is required. You will work closely with the backend team.',
    4,
    10,
    '4667a67b-bb8e-42ad-b137-0be342f1b548'
),
(
    '78398a36-b26e-432a-8ca1-330ecda2e016',
    'Customer Success Specialist',
    'Support',
    'London, UK',
    'full_time',
    'closed',
    'Help our users succeed! You will onboard new accounts, answer complex product questions, and work with engineering to fix bugs. Strong communication skills are essential.',
    1,
    3,
    '4667a67b-bb8e-42ad-b137-0be342f1b548'
);
