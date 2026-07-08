import React from 'react';
import { StatusBadge } from '../core/StatusBadge.jsx';

/**
 * MarkerListItem — a single sign row in the marker modal / segment view.
 * Type glyph swatch + name + km meta + status pill, with optional trailing
 * action (delete, chevron). `highlight` flags a just-added marker.
 */
export function MarkerListItem({
  glyph = '→',
  hue = 'var(--marker-right)',
  name = 'Nuoli oikealle',
  km = null,
  status = 'asetettu',
  highlight = false,
  trailing = null,
  onClick,
  style = {},
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2-5)',
        padding: 'var(--pad-row)',
        minHeight: 'var(--touch-min)',
        borderBottom: '1px solid var(--border-card)',
        background: highlight ? 'var(--warn-highlight)' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        color: 'var(--text-body)',
        ...style,
      }}
    >
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
        background: hue, color: '#fff', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)',
        flexShrink: 0,
      }}>{glyph}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {km != null && <div style={{ fontSize: 'var(--text-meta)', color: 'var(--text-meta)', marginTop: '1px', fontVariantNumeric: 'tabular-nums' }}>{km}</div>}
      </div>
      <StatusBadge status={status} />
      {trailing}
    </div>
  );
}
