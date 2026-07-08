import React from 'react';

const STATUS = {
  suunniteltu: { label: 'Suunniteltu', text: 'var(--status-suunniteltu-text)', bg: 'var(--status-suunniteltu-bg)' },
  asetettu:    { label: 'Asetettu',    text: 'var(--status-asetettu-text)',    bg: 'var(--status-asetettu-bg)' },
  tarkistettu: { label: 'Tarkistettu', text: 'var(--status-tarkistettu-text)', bg: 'var(--status-tarkistettu-bg)' },
  keratty:     { label: 'Kerätty',     text: 'var(--status-keratty-text)',     bg: 'var(--status-keratty-bg)' },
  ei_tarpeen:  { label: 'Ei tarpeen',  text: 'var(--status-ei-tarpeen-text)',  bg: 'var(--status-ei-tarpeen-bg)' },
};

/**
 * StatusBadge — the marker lifecycle pill.
 * suunniteltu → asetettu → tarkistettu → kerätty (+ ei_tarpeen).
 * Colours are AA-tuned per theme via the --status-* tokens.
 */
export function StatusBadge({ status = 'suunniteltu', children, style = {}, ...rest }) {
  const s = STATUS[status] || STATUS.suunniteltu;
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 'var(--text-meta)',
        fontWeight: 'var(--weight-medium)',
        letterSpacing: 'var(--tracking-caps)',
        textTransform: 'uppercase',
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        color: s.text,
        background: s.bg,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children || s.label}
    </span>
  );
}
