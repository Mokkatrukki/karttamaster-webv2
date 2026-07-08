import React from 'react';

/**
 * Karttamaster Button.
 * Every variant honours the 44px touch floor — this is a gloves-in-the-forest
 * product, so even "small" never goes below the touch minimum in height.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  iconLeft = null,
  iconRight = null,
  disabled = false,
  type = 'button',
  style = {},
  children,
  ...rest
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    minHeight: size === 'lg' ? '52px' : 'var(--touch-min)',
    padding: size === 'sm' ? 'var(--pad-btn-sm)'
           : size === 'lg' ? '14px 20px'
           : 'var(--pad-btn)',
    width: fullWidth ? '100%' : 'auto',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: size === 'lg' ? 'var(--text-base)' : 'var(--text-sm)',
    fontWeight: 'var(--weight-medium)',
    letterSpacing: 'var(--tracking-btn)',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.45 : 1,
    transition: 'background var(--dur-instant) var(--ease), color var(--dur-instant) var(--ease)',
  };

  const variants = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--accent-text)',
      fontWeight: 'var(--weight-bold)',
    },
    confirm: {
      background: 'var(--confirm)',
      color: 'var(--confirm-text)',
      fontWeight: 'var(--weight-bold)',
    },
    secondary: {
      background: 'var(--field-tint)',
      color: 'var(--text-body)',
      borderColor: 'var(--border-strong)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)',
      borderColor: 'var(--border-default)',
    },
    danger: {
      background: 'var(--danger-soft)',
      color: 'var(--danger-text)',
      borderColor: 'color-mix(in srgb, var(--danger) 25%, transparent)',
    },
  };

  return (
    <button
      type={type}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      {...rest}
    >
      {iconLeft}
      {children && <span>{children}</span>}
      {iconRight}
    </button>
  );
}
