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
  color: string
}

// V99/T160: kompakti kartta-teksti johdetaan labelista (compactLabel), ei erillistä shortLabelia.
// V132/T202: tyyppivärit uuteen Reittimerkki-palettiin — eri sävyperheet (B58),
// väri = tyyppi-tunniste (V96), luettavia valkoisella korttitaustalla (T208).
export const SIGN_TYPES: SignTypeInfo[] = [
  { type: 'left',          label: 'Vasemmalle',         color: '#2563EB' },
  { type: 'right',         label: 'Oikealle',           color: '#16A34A' },
  { type: 'upcoming-left', label: 'Tuleva vasemmalle',  color: '#9333EA' },
  { type: 'upcoming-right',label: 'Tuleva oikealle',    color: '#C2410C' },
]
