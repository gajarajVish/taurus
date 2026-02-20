import React from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  /** Fixed pixel width. Omit for responsive (fills container). */
  width?: number;
  /** Fixed pixel height. Omit for responsive (fills container). */
  height?: number;
  filled?: boolean;
}

let sparklineIdCounter = 0;

export function Sparkline({ data, color = '#4f8fff', width, height, filled = false }: SparklineProps) {
  // Internal coordinate space
  const vw = width ?? 200;
  const vh = height ?? 60;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3;

  const coords = data.map((d, i) => ({
    x: (i / (data.length - 1)) * vw,
    y: pad + (vh - pad * 2) - ((d - min) / range) * (vh - pad * 2),
  }));

  const points = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const fillPoints = filled ? `0,${vh} ${points} ${vw},${vh}` : undefined;
  const gradientId = `sg-${sparklineIdCounter++}`;

  // Responsive mode: use viewBox + 100% width when no explicit size given
  const responsive = width === undefined;

  return (
    <svg
      {...(responsive
        ? { viewBox: `0 0 ${vw} ${vh}`, preserveAspectRatio: 'none', style: { display: 'block', width: '100%', height: height ?? '100%' } }
        : { width: vw, height: vh, style: { overflow: 'visible' } }
      )}
      className="sparkline"
    >
      {filled && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {filled && fillPoints && (
        <polygon fill={`url(#${gradientId})`} points={fillPoints} />
      )}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={responsive ? '2.5' : '2'}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {coords.length > 0 && (
        <>
          <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="5" fill={color} opacity="0.2" />
          <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="3" fill={color} />
        </>
      )}
    </svg>
  );
}
