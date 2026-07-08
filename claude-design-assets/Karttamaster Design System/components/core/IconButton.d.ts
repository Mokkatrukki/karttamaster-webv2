import * as React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — becomes aria-label + title. Icon-only buttons must be labelled (§A). */
  label: string;
  variant?: 'ghost' | 'solid' | 'danger';
  /** Active/pressed state paints amber accent (e.g. role toggle on). */
  active?: boolean;
  /** Square edge length in px. Floored at 44. */
  size?: number;
}

/** Square icon-only control, fixed at the 44px touch target. */
export function IconButton(props: IconButtonProps): React.ReactElement;
