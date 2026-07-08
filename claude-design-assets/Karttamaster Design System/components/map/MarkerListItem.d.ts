import * as React from 'react';
import type { MarkerStatus } from '../core/StatusBadge';

export interface MarkerListItemProps {
  /** Type glyph in the swatch. */
  glyph?: React.ReactNode;
  /** Swatch hue — a --marker-* token. */
  hue?: string;
  name?: string;
  /** Meta line, e.g. "12,4 km · 55-reitti". */
  km?: React.ReactNode;
  status?: MarkerStatus;
  /** Amber wash for a just-added marker. */
  highlight?: boolean;
  /** Trailing control (delete button, chevron). */
  trailing?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** A single sign row for the marker modal / segment list. */
export function MarkerListItem(props: MarkerListItemProps): React.ReactElement;
