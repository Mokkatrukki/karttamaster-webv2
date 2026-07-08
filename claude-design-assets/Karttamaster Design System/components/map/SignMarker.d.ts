import * as React from 'react';

export type SignType = 'right' | 'left' | 'up_r' | 'up_l';

export interface SignMarkerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Type hue + identity. up_* render a dashed "upcoming" ring. */
  type?: SignType;
  /** Heading in degrees; rotates the head, not the tip. */
  bearing?: number;
  /** Lifecycle status — planned fades to 0.45 and hides the dot. */
  status?: 'suunniteltu' | 'asetettu' | 'tarkistettu' | 'keratty' | 'ei_tarpeen';
  /** Glyph inside the circle (arrow, text). */
  glyph?: React.ReactNode;
  /** Scale multiplier on the 32×52 base. */
  size?: number;
}

/** Teardrop map pin, anchored at the tip. */
export function SignMarker(props: SignMarkerProps): React.ReactElement;
