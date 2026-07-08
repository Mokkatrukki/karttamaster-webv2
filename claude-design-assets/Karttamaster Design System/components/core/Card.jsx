import React from 'react';

/** Surface container — modals, dropdowns, panel sections. */
export function Card({ elevation = 'flat', padding = 'md', style = {}, children, ...rest }) {
  const shadows = {
    flat: 'none',
    dropdown: 'var(--shadow-dropdown)',
    modal: 'var(--shadow-modal)',
  };
  const pads = { none: 0, sm: 'var(--space-2)', md: 'var(--space-3)', lg: 'var(--space-4)' };
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: shadows[elevation],
        padding: pads[padding],
        color: 'var(--text-body)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
