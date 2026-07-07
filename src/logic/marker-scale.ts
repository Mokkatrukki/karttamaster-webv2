// T175/V109: kartan merkki-ikonien zoom-skaalaus. Kaukana zoomattuna pieni, lähellä täysi koko.
export const MARKER_SCALE_ZOOM_MIN = 11
export const MARKER_SCALE_ZOOM_MAX = 17
export const MARKER_SCALE_MIN = 0.3
export const MARKER_SCALE_MAX = 1

export function markerScaleForZoom(zoom: number): number {
  if (zoom <= MARKER_SCALE_ZOOM_MIN) return MARKER_SCALE_MIN
  if (zoom >= MARKER_SCALE_ZOOM_MAX) return MARKER_SCALE_MAX
  const t = (zoom - MARKER_SCALE_ZOOM_MIN) / (MARKER_SCALE_ZOOM_MAX - MARKER_SCALE_ZOOM_MIN)
  return MARKER_SCALE_MIN + t * (MARKER_SCALE_MAX - MARKER_SCALE_MIN)
}
