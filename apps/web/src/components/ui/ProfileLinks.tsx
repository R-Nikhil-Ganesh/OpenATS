'use client';

import React from 'react';
import { Linkedin, Github, Link2 } from 'lucide-react';

type Props = {
  links?: { linkedin?: string; github?: string; portfolio?: string };
  size?: number;
};

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Small row of icon links (LinkedIn/GitHub/portfolio) extracted from a resume profile. Renders nothing if no links are present. */
export function ProfileLinks({ links, size = 14 }: Props) {
  const entries: { key: string; url: string; Icon: typeof Linkedin; label: string }[] = [];
  if (links?.linkedin) entries.push({ key: 'linkedin', url: links.linkedin, Icon: Linkedin, label: 'LinkedIn' });
  if (links?.github) entries.push({ key: 'github', url: links.github, Icon: Github, label: 'GitHub' });
  if (links?.portfolio) entries.push({ key: 'portfolio', url: links.portfolio, Icon: Link2, label: 'Portfolio' });

  if (!entries.length) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {entries.map(({ key, url, Icon, label }) => (
        <a
          key={key}
          href={normalizeUrl(url)}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'inline-flex', color: 'var(--color-muted)' }}
        >
          <Icon size={size} />
        </a>
      ))}
    </div>
  );
}
