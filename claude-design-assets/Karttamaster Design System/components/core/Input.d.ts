import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Uppercase meta label rendered above the field. */
  label?: string;
  /** Helper / error text below the field. */
  hint?: string;
  invalid?: boolean;
}

/** Field-grade text input, 44px tall with accent focus ring. */
export function Input(props: InputProps): React.ReactElement;
