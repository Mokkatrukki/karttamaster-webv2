import React from 'react';

/**
 * DriveBanner — GPS drive-mode read-out. "Seuraava merkki 300 m →".
 * Built to be read at a glance, one-handed, in motion. The distance is the
 * single biggest thing on screen; it turns green when you're within range.
 * This is the one sanctioned break from the 11–14px type ceiling.
 */
export function DriveBanner({
  distance = '300 m',
  label = 'Seuraava merkki',
  direction = '→',
  near = false,
  action = null,
  style = {},
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: near ? 'var(--status-asetettu-bg)' : 'var(--field-tint)',
        border: `1px solid ${near ? 'var(--status-asetettu-text)' : 'var(--border-default)'}`,
        transition: 'background var(--dur-base) var(--ease), border-color var(--dur-base) var(--ease)',
        ...style,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          fontSize: 'var(--text-drive-lg)',
          lineHeight: 1,
          color: near ? 'var(--status-asetettu-text)' : 'var(--text-body)',
          flexShrink: 0,
        }}
      >
        {direction}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{
          fontSize: 'var(--text-drive)',
          fontWeight: 'var(--weight-bold)',
          lineHeight: 1,
          color: near ? 'var(--status-asetettu-text)' : 'var(--text-body)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {distance}
        </span>
        <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
      </div>
      {action}
    </div>
  );
}
