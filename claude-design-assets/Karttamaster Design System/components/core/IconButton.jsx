import React from 'react';

/**
 * IconButton — a square, icon-only control fixed at the 44px touch target.
 * Used for toolbar overflow (⋯), modal close (✕), route prev/next (◀ ▶),
 * visibility toggles. ALWAYS pass `label` → becomes aria-label (DESIGN.md §A).
 */
export function IconButton({
  label,
  variant = 'ghost',
  active = false,
  size = 44,
  disabled = false,
  style = {},
  children,
  ...rest
}) {
  const variants = {
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)',
      borderColor: 'var(--border-strong)',
    },
    solid: {
      background: 'var(--field-tint)',
      color: 'var(--text-body)',
      borderColor: 'var(--border-default)',
    },
    danger: {
      background: 'var(--danger-soft)',
      color: 'var(--danger-text)',
      borderColor: 'color-mix(in srgb, var(--danger) 25%, transparent)',
    },
  };

  const activeStyle = active
    ? { background: 'var(--accent)', color: 'var(--accent-text)', borderColor: 'transparent' }
    : {};

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        minWidth: 'var(--touch-min)',
        minHeight: 'var(--touch-min)',
        padding: 0,
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '18px',
        lineHeight: 1,
        opacity: disabled ? 0.35 : 1,
        transition: 'background var(--dur-instant) var(--ease), color var(--dur-instant) var(--ease)',
        ...variants[variant],
        ...activeStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
