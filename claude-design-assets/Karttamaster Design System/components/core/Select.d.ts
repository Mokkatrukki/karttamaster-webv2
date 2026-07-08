import * as React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

/** Native select matched to Input — used for marker-type and status pickers. */
export function Select(props: SelectProps): React.ReactElement;
