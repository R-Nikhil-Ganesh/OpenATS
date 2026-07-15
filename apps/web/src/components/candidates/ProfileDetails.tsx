'use client';

import React from 'react';
import type { ResumeProfile } from '@/lib/api';
import { ProfileLinks } from '@/components/ui/ProfileLinks';

const sectionLabelStyle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

type Props = {
  profile?: ResumeProfile;
};

/** Full structured-profile layout (contact, summary, skills, experience, education) shared by the candidate detail page's Profile tab and the quick-view modal. No chip/pill styling by design — plain, readable text. */
export function ProfileDetails({ profile }: Props) {
  if (!profile) {
    return (
      <div style={{ color: 'var(--color-muted)', textAlign: 'center', padding: '40px' }}>
        No structured profile available yet
      </div>
    );
  }

  const hasLinks = !!(profile.links?.linkedin || profile.links?.github || profile.links?.portfolio);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {(profile.location || hasLinks) && (
        <section>
          <h4 style={sectionLabelStyle}>Contact</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {profile.location && (
              <span style={{ fontSize: '13px', color: 'var(--color-text-body)' }}>{profile.location}</span>
            )}
            <ProfileLinks links={profile.links} size={15} />
          </div>
        </section>
      )}

      {profile.summary && (
        <section>
          <h4 style={sectionLabelStyle}>Summary</h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-body)', lineHeight: 1.6 }}>
            {profile.summary}
          </p>
        </section>
      )}

      {profile.skills.length > 0 && (
        <section>
          <h4 style={sectionLabelStyle}>Skills</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
            {profile.skills.map((skill) => (
              <span key={skill} style={{ fontSize: '13px', color: 'var(--color-text-body)' }}>
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {profile.experience.length > 0 && (
        <section>
          <h4 style={sectionLabelStyle}>Experience</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {profile.experience.map((job, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-strong)' }}>
                    {job.title}{job.company ? ` · ${job.company}` : ''}
                  </span>
                  {job.duration && (
                    <span style={{ fontSize: '11px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                      {job.duration}
                    </span>
                  )}
                </div>
                {job.highlights.length > 0 && (
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {job.highlights.map((h, j) => (
                      <li key={j} style={{ fontSize: '12.5px', color: 'var(--color-text-body)', lineHeight: 1.5 }}>
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.education.length > 0 && (
        <section>
          <h4 style={sectionLabelStyle}>Education</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {profile.education.map((ed, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-strong)', fontWeight: 500 }}>
                  {ed.degree}{ed.institution ? ` · ${ed.institution}` : ''}
                </span>
                {ed.year && (
                  <span style={{ fontSize: '11px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{ed.year}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
