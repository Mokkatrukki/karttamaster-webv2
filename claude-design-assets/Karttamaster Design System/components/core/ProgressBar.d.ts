import * as React from 'react';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. */
  value?: number;
  /** Leading short label (e.g. "35km"). */
  label?: React.ReactNode;
  /** Trailing percent text; defaults to rounded value%. Pass null to hide. */
  pct?: React.ReactNode | null;
  /** Trailing detail (e.g. "12/40"). */
  detail?: React.ReactNode;
  height?: number;
  /** Fill colour token. Defaults to --confirm (green). */
  fill?: string;
}

/** Route completion + per-route status overview bar. */
export function ProgressBar(props: ProgressBarProps): React.ReactElement;
