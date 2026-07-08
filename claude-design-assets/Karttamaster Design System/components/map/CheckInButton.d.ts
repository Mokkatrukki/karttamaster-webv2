import * as React from 'react';

export interface CheckInSecondaryAction {
  label: string;
  variant?: 'secondary' | 'ghost' | 'danger';
  onClick?: () => void;
}

export interface CheckInButtonProps {
  /** Big green button label (e.g. "Merkitse asetetuksi"). */
  label?: string;
  /** Optional sub-line under the label (e.g. the marker name). */
  sub?: React.ReactNode;
  onConfirm?: () => void;
  /** Up to ~2 smaller actions beneath ("Ei tarpeen", "Lisäsin toisen"). */
  secondary?: CheckInSecondaryAction[];
  style?: React.CSSProperties;
}

/**
 * The volunteer's dominant one-tap field action.
 * @startingPoint section="Field" subtitle="Dominant one-tap check-in + secondaries" viewport="700x220"
 */
export function CheckInButton(props: CheckInButtonProps): React.ReactElement;
