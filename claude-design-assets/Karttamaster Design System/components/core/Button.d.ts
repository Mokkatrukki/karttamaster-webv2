import * as React from 'react';

export type ButtonVariant = 'primary' | 'confirm' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * primary  — amber, the single most important action on a view ("+ Merkki")
   * confirm  — green, the volunteer's check-in / "Asetettu" action
   * secondary— tinted neutral, standard action
   * ghost    — bordered transparent, low-emphasis (GPS toggle, role)
   * danger   — soft red, destructive (delete, restore)
   */
  variant?: ButtonVariant;
  /** sm/md stay ≥44px tall; lg is 52px for the dominant field action. */
  size?: ButtonSize;
  fullWidth?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

/**
 * The Karttamaster button. All variants meet the 44px touch floor.
 * @startingPoint section="Core" subtitle="Buttons — primary, confirm, ghost, danger" viewport="700x180"
 */
export function Button(props: ButtonProps): React.ReactElement;
