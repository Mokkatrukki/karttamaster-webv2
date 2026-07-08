import * as React from 'react';

export interface DriveBannerProps {
  /** Big tabular distance read-out, e.g. "300 m". */
  distance?: React.ReactNode;
  /** Sub-label, e.g. "Seuraava merkki". */
  label?: React.ReactNode;
  /** Direction glyph (→ ← ↑ etc). */
  direction?: React.ReactNode;
  /** Within range — turns the banner green. */
  near?: boolean;
  /** Optional trailing action (e.g. a "Hyppää" IconButton/Button). */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * GPS drive-mode glanceable distance banner.
 * @startingPoint section="Field" subtitle="Glanceable GPS drive read-out" viewport="700x110"
 */
export function DriveBanner(props: DriveBannerProps): React.ReactElement;
