import * as React from 'react';

export interface RouteTabProps {
  /** Distance label, e.g. "55 km". */
  label?: string;
  /** Route hue token — use --route-1..4. */
  color?: string;
  /** Selected route (bright outline + drive glyph). */
  active?: boolean;
  /** Route hidden on the map (dims to 0.35, eye → eye-off). */
  hidden?: boolean;
  onSelect?: () => void;
  onToggleVisibility?: () => void;
  style?: React.CSSProperties;
}

/** Route selector chip with a divided visibility toggle. */
export function RouteTab(props: RouteTabProps): React.ReactElement;
