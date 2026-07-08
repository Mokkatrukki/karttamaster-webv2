import React from 'react';

/**
 * RouteTab — a route selector chip in the bottom route-bar.
 * Solid route-hue body with km label + drive glyph, plus a divided
 * visibility (eye) toggle. Active route gets a bright outline; hidden
 * routes dim to 0.35.
 */
export function RouteTab({
  label = '55 km',
  color = 'var(--route-1)',
  active = false,
  hidden = false,
  onSelect,
  onToggleVisibility,
  style = {},
}) {
  return (
    <div
      style={{
        display: 'flex',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        border: `1.5px solid ${active ? 'rgba(255,255,255,0.65)' : 'transparent'}`,
        background: color,
        opacity: hidden ? 0.35 : 1,
        transition: 'border-color var(--dur-fast) var(--ease), opacity var(--dur-base) var(--ease)',
        ...style,
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1-5)',
          minHeight: 'var(--touch-min)',
          padding: '5px 12px',
          background: 'transparent',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-btn)',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff', opacity: 0.9, flexShrink: 0 }} />
        <span>{label}</span>
        <span style={{ fontSize: '9px', opacity: active ? 0.9 : 0, transition: 'opacity var(--dur-fast)' }}>▶</span>
      </button>
      <button
        type="button"
        aria-label={hidden ? 'Näytä reitti' : 'Piilota reitti'}
        aria-pressed={!hidden}
        onClick={onToggleVisibility}
        style={{
          width: 'var(--touch-min)',
          minHeight: 'var(--touch-min)',
          border: 'none',
          borderLeft: '1px solid rgba(255,255,255,0.25)',
          background: 'rgba(0,0,0,0.12)',
          color: hidden ? 'rgba(255,255,255,0.5)' : '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        {hidden ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
