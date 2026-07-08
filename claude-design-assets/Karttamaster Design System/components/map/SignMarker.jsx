import React from 'react';

const HUE = {
  right: 'var(--marker-right)',
  left:  'var(--marker-left)',
  up_r:  'var(--marker-up-r)',
  up_l:  'var(--marker-up-l)',
};

const STATUS_DOT = {
  suunniteltu: null,
  asetettu:    'var(--status-asetettu-text)',
  tarkistettu: 'var(--status-tarkistettu-text)',
  keratty:     'var(--status-keratty-text)',
  ei_tarpeen:  'var(--status-ei-tarpeen-text)',
};

/**
 * SignMarker — the teardrop map pin (recreation of src/map/icons.ts).
 * 32×52, anchored at the tip (16,52). Circle rotates to bearing; the tip is
 * fixed and points at the exact ground position. Type hue is the constant
 * identity; status only changes OPACITY (planned = faded) + a small dot.
 * `upcoming` types render a dashed ring.
 */
export function SignMarker({
  type = 'right',
  bearing = 0,
  status = 'asetettu',
  glyph = '→',
  size = 1,
  style = {},
  ...rest
}) {
  const color = HUE[type] || HUE.right;
  const dashed = type === 'up_r' || type === 'up_l';
  const dot = STATUS_DOT[status];
  const faded = status === 'suunniteltu';
  const w = 32 * size, h = 52 * size;

  return (
    <div style={{ position: 'relative', width: `${w}px`, height: `${h}px`, opacity: faded ? 0.45 : 1, ...style }} {...rest}>
      {/* rotating head */}
      <svg
        width={w} height={w} viewBox="0 0 32 32"
        style={{ position: 'absolute', top: 0, left: 0, transform: `rotate(${bearing}deg)` }}
      >
        <circle
          cx="16" cy="16" r="14"
          fill={color} stroke="#fff" strokeWidth="2"
          strokeDasharray={dashed ? '4 2' : undefined}
        />
        <text x="16" y="21" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="var(--font-ui)">{glyph}</text>
      </svg>
      {/* fixed tip — points at exact location */}
      <svg
        width={w} height={10 * size} viewBox="0 0 32 10"
        style={{ position: 'absolute', bottom: 0, left: 0 }}
      >
        <path d="M8,0 L16,10 L24,0 Z" fill={color} stroke="#fff" strokeWidth="2" />
      </svg>
      {/* status dot */}
      {dot && (
        <span style={{
          position: 'absolute',
          right: `${2 * size}px`,
          bottom: `${12 * size}px`,
          width: `${8 * size}px`,
          height: `${8 * size}px`,
          borderRadius: '50%',
          background: dot,
          border: '1.5px solid #fff',
          boxSizing: 'border-box',
        }} />
      )}
    </div>
  );
}
