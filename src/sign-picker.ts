import type { MarkerType } from './types'

export interface PickerPosition {
  x: number
  y: number
}

export function positionPicker(
  clickX: number,
  clickY: number,
  pickerW: number,
  pickerH: number,
  viewportW: number,
  viewportH: number,
): PickerPosition {
  const OFFSET = 20
  let x = clickX
  let y = clickY + OFFSET

  if (y + pickerH > viewportH) y = clickY - pickerH - OFFSET
  if (y < 0) y = OFFSET

  if (x + pickerW > viewportW) x = viewportW - pickerW - 4
  if (x < 0) x = 4

  return { x, y }
}

export interface SignTypeInfo {
  type: MarkerType
  label: string
  shortLabel: string
  color: string
}

export const SIGN_TYPES: SignTypeInfo[] = [
  { type: 'left',          label: 'Vasemmalle',         shortLabel: 'V',  color: '#2563eb' },
  { type: 'right',         label: 'Oikealle',           shortLabel: 'O',  color: '#16a34a' },
  { type: 'upcoming-left', label: 'Tuleva vasemmalle',  shortLabel: 'TV', color: '#7c3aed' },
  { type: 'upcoming-right',label: 'Tuleva oikealle',    shortLabel: 'TO', color: '#b45309' },
]
