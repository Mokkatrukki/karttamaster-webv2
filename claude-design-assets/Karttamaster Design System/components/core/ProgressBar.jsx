import React from 'react';

/**
 * ProgressBar — route completion + per-route status overview (organizer panel).
 * Thin track with green fill. Optional leading label + trailing percent/detail.
 */
export function ProgressBar({
  value = 0,
  label = null,
  pct = null,
  detail = null,
  height = 6,
  fill = 'var(--confirm)',
  style = {},
  ...rest
}) {
  const v = Math.max(0, Math.min(100, value));
  const shownPct = pct == null ? `${Math.round(v)}%` : pct;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-meta)', ...style }} {...rest}>
      {label != null && (
        <span style={{ width: '44px', flexShrink: 0, color: 'var(--text-muted)', fontWeight: 'var(--weight-medium)' }}>
          {label}
        </span>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(v)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          flex: 1,
          height: `${height}px`,
          background: 'var(--field-tint)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}
      >
        <div style={{
          width: `${v}%`,
          height: '100%',
          background: fill,
          borderRadius: '999px',
          transition: 'width var(--dur-base) var(--ease)',
        }} />
      </div>
      {shownPct != null && (
        <span style={{
          minWidth: '32px',
          textAlign: 'right',
          color: 'var(--confirm)',
          fontWeight: 'var(--weight-bold)',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}>
          {shownPct}
        </span>
      )}
      {detail != null && (
        <span style={{ minWidth: '40px', textAlign: 'right', color: 'var(--text-meta)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {detail}
        </span>
      )}
    </div>
  );
}
