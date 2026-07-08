import React from 'react';

/** Native select styled to match Input — 44px, marker-type / status pickers. */
export function Select({ label = null, style = {}, id, children, ...rest }) {
  const selId = id || (label ? `sel-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', width: '100%' }}>
      {label && (
        <label
          htmlFor={selId}
          style={{
            fontSize: 'var(--text-meta)',
            fontWeight: 'var(--weight-medium)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </label>
      )}
      <select
        id={selId}
        style={{
          width: '100%',
          minHeight: 'var(--touch-min)',
          padding: '8px 12px',
          background: 'var(--surface-app)',
          color: 'var(--text-body)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-sm)',
          cursor: 'pointer',
          outline: 'none',
          boxSizing: 'border-box',
          ...style,
        }}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
