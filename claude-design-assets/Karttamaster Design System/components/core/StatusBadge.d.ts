import * as React from 'react';

export type MarkerStatus =
  | 'suunniteltu'
  | 'asetettu'
  | 'tarkistettu'
  | 'keratty'
  | 'ei_tarpeen';

export interface StatusBadgeProps {
  status?: MarkerStatus;
  /** Override the default Finnish label. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Marker lifecycle pill — AA-tuned per theme. */
export function StatusBadge(props: StatusBadgeProps): React.ReactElement;
