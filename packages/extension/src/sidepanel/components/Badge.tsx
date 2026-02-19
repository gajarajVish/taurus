import React from 'react';

interface BadgeProps {
  label: string;
  variant?: 'neutral' | 'positive' | 'negative' | 'warning' | 'brand';
  size?: 'sm' | 'md';
}

export function Badge({ label, variant = 'neutral', size = 'md' }: BadgeProps) {
  return (
    <span className={`badge ${variant} ${size}`}>
      {label}
    </span>
  );
}

