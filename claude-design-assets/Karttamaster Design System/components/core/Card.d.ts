import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 'flat' | 'dropdown' | 'modal';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/** Surface container for modals, dropdowns and panel sections. */
export function Card(props: CardProps): React.ReactElement;
