import React from 'react';

/** Field-grade text input. 44px tall, accent focus ring, full-width by default. */
export function Input({
  label = null,
  hint = null,
  invalid = false,
  style = {},
  id,
  ...rest
}) {
  const inputId = id || (label ? `in-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
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
      <input
        id={inputId}
        aria-invalid={invalid || undefined}
        style={{
          width: '100%',
          minHeight: 'var(--touch-min)',
          padding: '10px 12px',
          background: 'var(--surface-app)',
          color: 'var(--text-body)',
          border: `1px solid ${invalid ? 'var(--danger)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-base)',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color var(--dur-fast) var(--ease)',
          ...style,
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.target.style.borderColor = invalid ? 'var(--danger)' : 'var(--border-default)'; }}
        {...rest}
      />
      {hint && (
        <span style={{ fontSize: 'var(--text-meta)', color: invalid ? 'var(--danger-text)' : 'var(--text-meta)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}
