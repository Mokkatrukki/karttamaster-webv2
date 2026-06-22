export interface IconEntry {
  id: string
  label: string
  svgContent: string
}

// V50: curated ~25 Lucide icons (stroke-based, viewBox 0 0 24 24)
export const CURATED_ICONS: IconEntry[] = [
  { id: 'arrow-right',      label: 'Nuoli oikealle',    svgContent: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>' },
  { id: 'arrow-left',       label: 'Nuoli vasemmalle',  svgContent: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>' },
  { id: 'arrow-up',         label: 'Suoraan / ylös',   svgContent: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>' },
  { id: 'arrow-down',       label: 'Nuoli alas',       svgContent: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>' },
  { id: 'corner-up-right',  label: 'Käänny oikealle',  svgContent: '<polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>' },
  { id: 'corner-up-left',   label: 'Käänny vasemmalle',svgContent: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>' },
  { id: 'alert-triangle',   label: 'Varoitus',         svgContent: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>' },
  { id: 'info',             label: 'Info',             svgContent: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>' },
  { id: 'check',            label: 'OK / tehty',       svgContent: '<path d="M20 6 9 17l-5-5"/>' },
  { id: 'x',               label: 'Kielletty / ei',   svgContent: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>' },
  { id: 'flag',             label: 'Lippu / maali',    svgContent: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>' },
  { id: 'map-pin',          label: 'Sijainti',         svgContent: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>' },
  { id: 'star',             label: 'Tärkeä',           svgContent: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
  { id: 'wrench',           label: 'Huolto / työkalu', svgContent: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
  { id: 'package',          label: 'Tarvikkeet',       svgContent: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/>' },
  { id: 'tree-pine',        label: 'Metsä',            svgContent: '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3A1 1 0 0 1 15.2 9H15l3 3.3a1 1 0 0 1-.7 1.7H17z"/><path d="M12 22v-3"/>' },
  { id: 'mountain',         label: 'Maasto / vaara',   svgContent: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>' },
  { id: 'bike',             label: 'Pyörä',            svgContent: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>' },
  { id: 'car',              label: 'Auto',             svgContent: '<path d="M19 17H5v-3.634a4 4 0 0 1 .24-1.369l1.32-3.292a2 2 0 0 1 1.869-1.205H15.57a2 2 0 0 1 1.866 1.219l1.295 3.292A4 4 0 0 1 19 14.366V17z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>' },
  { id: 'home',             label: 'Tukikohta',        svgContent: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  { id: 'phone',            label: 'Puhelin / yhteys', svgContent: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.27 12 19.79 19.79 0 0 1 1.17 3.4 2 2 0 0 1 3.11 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.18 6.18l1.46-1.46a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' },
  { id: 'help-circle',      label: 'Neuvonta',         svgContent: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>' },
  { id: 'zap',              label: 'Sähkö / energia',  svgContent: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  { id: 'droplets',         label: 'Vesi / juomapiste',svgContent: '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>' },
  { id: 'parking-circle',   label: 'Parkkipaikka',     svgContent: '<circle cx="12" cy="12" r="10"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>' },
]

export function getIconById(id: string): IconEntry | undefined {
  return CURATED_ICONS.find(icon => icon.id === id)
}

// Returns SVG string using currentColor stroke — safe to embed in HTML (content from CURATED_ICONS only)
export function renderIconSvg(iconId: string, size: number): string {
  const icon = getIconById(iconId)
  if (!icon) return ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon.svgContent}</svg>`
}
