import React from 'react';
import { Button } from '../core/Button.jsx';

/**
 * CheckInButton — the volunteer's dominant field action.
 * One huge green button does the normal thing in a single tap; secondary
 * options ("Ei tarpeen", "Lisäsin toisen") sit smaller beneath. This is the
 * whole point of the volunteer view: max one tap to the common case.
 */
export function CheckInButton({
  label = 'Merkitse asetetuksi',
  sub = null,
  onConfirm,
  secondary = [],
  style = {},
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%', ...style }}>
      <button
        type="button"
        onClick={onConfirm}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          width: '100%',
          minHeight: '72px',
          background: 'var(--confirm)',
          color: 'var(--confirm-text)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          fontSize: '18px',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-btn)',
          boxShadow: 'var(--shadow-dropdown)',
          transition: 'background var(--dur-instant) var(--ease), transform var(--dur-instant) var(--ease)',
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.985)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <span>{label}</span>
        {sub && <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', opacity: 0.85 }}>{sub}</span>}
      </button>
      {secondary.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-1-5)' }}>
          {secondary.map((s, i) => (
            <Button key={i} variant={s.variant || 'secondary'} size="md" fullWidth onClick={s.onClick} style={{ flex: 1 }}>
              {s.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
